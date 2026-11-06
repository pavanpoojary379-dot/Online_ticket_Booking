import json
import math
from typing import Dict, Any, List, Optional, Tuple, Set
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, timedelta

from app.models.theatre import Theatre
from app.models.screen import Screen
from app.models.seat import Seat
from app.models.booking import Booking, BookingSeat
from app.models.movie import Movie
from app.models.show import Show
from app.schemas.theatre_layout import DemoClassroomPresetRequest

def compute_layout_geometry(layout: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes precise coordinates, row positions, aisle geometry, and checkpoint positions
    for a customized cinema or temporary classroom auditorium.
    """
    rows: List[str] = layout.get("rows") or ["A", "B", "C", "D", "E"]
    seats_per_row: int = int(layout.get("seats_per_row") or 6)
    aisle_after_seat: int = int(layout.get("aisle_after_seat") or 3)
    side_aisles: bool = layout.get("side_aisles", True)
    screen_position: str = layout.get("screen_position", "FRONT").upper()
    entrance_pos: str = layout.get("entrance_position", "BACK_CENTER").upper()

    num_rows = len(rows)

    # 1. Calculate row vertical positions (y-axis: 24.0 to 84.0)
    row_positions: Dict[str, float] = {}
    for idx, r in enumerate(rows):
        if num_rows <= 1:
            y_pos = 54.0
        else:
            y_pos = 24.0 + idx * ((84.0 - 24.0) / (num_rows - 1))
        row_positions[r] = round(y_pos, 2)

    # 2. Calculate seat horizontal positions (x-axis)
    # Split row into Left Wing (seats 1 .. aisle_after_seat) and Right Wing (aisle_after_seat + 1 .. seats_per_row)
    left_count = min(aisle_after_seat, seats_per_row)
    right_count = max(0, seats_per_row - left_count)

    # Determine bounds based on presence of side aisles
    left_min_x = 16.0 if side_aisles else 10.0
    left_max_x = 42.0  # Leaves central corridor (44.0 - 56.0)
    right_min_x = 58.0
    right_max_x = 84.0 if side_aisles else 90.0

    def calc_x(seat_idx: int) -> float:
        """seat_idx is 1-indexed (1 to seats_per_row)"""
        if seat_idx <= left_count:
            if left_count <= 1:
                return round((left_min_x + left_max_x) / 2.0, 2)
            frac = (seat_idx - 1) / (left_count - 1)
            return round(left_min_x + frac * (left_max_x - left_min_x), 2)
        else:
            right_idx = seat_idx - left_count
            if right_count <= 1:
                return round((right_min_x + right_max_x) / 2.0, 2)
            frac = (right_idx - 1) / (right_count - 1)
            return round(right_min_x + frac * (right_max_x - right_min_x), 2)

    # 3. Generate seat coordinates and tiers
    custom_seats: List[Dict[str, Any]] = []
    custom_lookup = {}
    if layout.get("custom_seats"):
        for cs in layout["custom_seats"]:
            key = (cs.get("row_label"), cs.get("seat_number"))
            custom_lookup[key] = cs

    for r_idx, r in enumerate(rows):
        y_val = row_positions[r]
        # Default tier distribution: Front rows Silver, Middle Gold, Rear Platinum
        if r_idx < max(1, num_rows // 3):
            default_tier = "SILVER"
        elif r_idx < max(2, (2 * num_rows) // 3):
            default_tier = "GOLD"
        else:
            default_tier = "PLATINUM"

        for s_num in range(1, seats_per_row + 1):
            custom_override = custom_lookup.get((r, s_num))
            x_val = custom_override.get("x") if custom_override and custom_override.get("x") is not None else calc_x(s_num)
            tier_val = custom_override.get("tier") if custom_override and custom_override.get("tier") else default_tier
            is_acc = (
                custom_override.get("is_accessible")
                if custom_override and "is_accessible" in custom_override
                else (r in [rows[0], rows[-1]] and s_num in [1, seats_per_row])
            )

            custom_seats.append({
                "row_label": r,
                "seat_number": s_num,
                "label": f"{r}{s_num}",
                "tier": tier_val,
                "x": round(x_val, 2),
                "y": round(y_val, 2),
                "is_accessible": is_acc,
            })

    # 4. Generate Aisle geometries
    aisles: List[Dict[str, Any]] = [
        {
            "id": "central_aisle",
            "name": "Central Main Aisle",
            "type": "VERTICAL",
            "x": 50.0,
            "width": 10.0,
            "y1": 16.0,
            "y2": 95.0,
        },
        {
            "id": "front_cross_aisle",
            "name": "Front Cross Aisle",
            "type": "HORIZONTAL",
            "y": 16.0,
            "height": 6.0,
            "x1": 8.0,
            "x2": 92.0,
        },
        {
            "id": "rear_cross_aisle",
            "name": "Rear Main Concourse",
            "type": "HORIZONTAL",
            "y": 90.0,
            "height": 8.0,
            "x1": 8.0,
            "x2": 92.0,
        },
    ]

    if side_aisles:
        aisles.extend([
            {
                "id": "left_aisle",
                "name": "Left Side Aisle",
                "type": "VERTICAL",
                "x": 8.0,
                "width": 6.0,
                "y1": 16.0,
                "y2": 90.0,
            },
            {
                "id": "right_aisle",
                "name": "Right Side Aisle",
                "type": "VERTICAL",
                "x": 92.0,
                "width": 6.0,
                "y1": 16.0,
                "y2": 90.0,
            },
        ])

    # 5. Entrance & Exit positions
    if entrance_pos == "BACK_LEFT":
        entrance = {"label": "Auditorium Entrance (Back Left)", "x": 10.0, "y": 95.0, "width": 10.0, "height": 4.0}
    elif entrance_pos == "BACK_RIGHT":
        entrance = {"label": "Auditorium Entrance (Back Right)", "x": 90.0, "y": 95.0, "width": 10.0, "height": 4.0}
    else:  # BACK_CENTER default
        entrance = {"label": "Auditorium Main Entrance", "x": 50.0, "y": 95.0, "width": 14.0, "height": 4.0}

    exit_elem = {"label": "Emergency Exit", "x": 8.0, "y": 16.0, "width": 8.0, "height": 4.0}

    # 6. Screen element
    screen_elem = {
        "label": "Front Presentation Screen" if screen_position == "FRONT" else "Rear Screen",
        "x1": 15.0,
        "x2": 85.0,
        "y": 7.0 if screen_position == "FRONT" else 96.0,
        "curvature": 20.0,
    }

    # 7. Checkpoints for simulation & demonstration
    checkpoints = [
        {
            "id": "entrance",
            "label": "1. Entrance Doorway",
            "description": "Standing at the auditorium entrance",
            "x": entrance["x"],
            "y": entrance["y"],
            "status": "ENTERING_AUDITORIUM",
        },
        {
            "id": "rear_aisle",
            "label": "2. Rear Concourse",
            "description": "Entering central corridor from rear doors",
            "x": 50.0,
            "y": 90.0,
            "status": "MOVING_TO_ROW",
        },
        {
            "id": "mid_aisle",
            "label": "3. Central Aisle Center",
            "description": "Moving down the main walkway",
            "x": 50.0,
            "y": 54.0,
            "status": "APPROACHING_ROW",
        },
    ]

    return {
        "rows": rows,
        "seats_per_row": seats_per_row,
        "aisle_after_seat": aisle_after_seat,
        "side_aisles": side_aisles,
        "screen_position": screen_position,
        "entrance_position": entrance_pos,
        "row_positions": row_positions,
        "custom_seats": custom_seats,
        "aisles": aisles,
        "entrance": entrance,
        "exit": exit_elem,
        "screen_element": screen_elem,
        "checkpoints": checkpoints,
        "is_demo_preset": layout.get("is_demo_preset", False),
        "preset_name": layout.get("preset_name"),
    }


def validate_layout_config(layout: Dict[str, Any]) -> None:
    """
    Validates screen layout parameters. Raises HTTPException(400) if invalid.
    """
    rows = layout.get("rows")
    if not rows or not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="Row configuration must be a non-empty list of row labels.")

    # Check for duplicate row labels
    if len(rows) != len(set(rows)):
        raise HTTPException(status_code=400, detail="Duplicate row labels are not allowed.")

    seats_per_row = layout.get("seats_per_row", 6)
    if not isinstance(seats_per_row, int) or seats_per_row < 1 or seats_per_row > 30:
        raise HTTPException(status_code=400, detail="Seats per row must be an integer between 1 and 30.")

    aisle_after = layout.get("aisle_after_seat", 3)
    if not isinstance(aisle_after, int) or aisle_after < 0 or aisle_after >= seats_per_row:
        raise HTTPException(status_code=400, detail="Aisle split must be between 0 and seats_per_row - 1.")

    # Validate custom seats if provided
    custom_seats = layout.get("custom_seats")
    if custom_seats:
        seen_labels = set()
        seen_coords = []
        for cs in custom_seats:
            lbl = f"{cs.get('row_label')}{cs.get('seat_number')}"
            if lbl in seen_labels:
                raise HTTPException(status_code=400, detail=f"Duplicate seat label '{lbl}' found in layout.")
            seen_labels.add(lbl)

            x = cs.get("x")
            y = cs.get("y")
            if x is not None and y is not None:
                # Check for overlapping seats (within 2.0 distance units)
                for ox, oy, olbl in seen_coords:
                    if math.hypot(x - ox, y - oy) < 2.0:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Seats '{lbl}' and '{olbl}' overlap at position ({x}, {y})."
                        )
                seen_coords.append((x, y, lbl))


def save_screen_layout_config(
    db: Session,
    screen_id: int,
    layout_data: Dict[str, Any],
    screen_name: Optional[str] = None
) -> Screen:
    """
    Validates, updates layout geometry, and synchronizes seats in the database.
    Preserves all existing booked seats to protect integrity.
    """
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail=f"Screen with ID {screen_id} not found.")

    validate_layout_config(layout_data)
    computed_layout = compute_layout_geometry(layout_data)

    # 1. Check existing booked seats on this screen
    booked_seat_records = (
        db.query(BookingSeat)
        .join(Seat, BookingSeat.seat_id == Seat.id)
        .filter(Seat.screen_id == screen_id)
        .all()
    )
    booked_seat_keys: Set[Tuple[str, int]] = set()
    for bs in booked_seat_records:
        if bs.seat:
            booked_seat_keys.add((bs.seat.row_label, bs.seat.seat_number))

    # 2. Check if new layout removes any booked seat
    new_seat_keys = {
        (s["row_label"], s["seat_number"])
        for s in computed_layout["custom_seats"]
    }
    missing_booked_seats = booked_seat_keys - new_seat_keys
    if missing_booked_seats:
        missing_str = ", ".join([f"{r}{n}" for r, n in missing_booked_seats])
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove seats [{missing_str}] because they are reserved in confirmed bookings."
        )

    # 3. Synchronize Seat rows in database
    existing_seats = db.query(Seat).filter(Seat.screen_id == screen_id).all()
    existing_lookup = {(s.row_label, s.seat_number): s for s in existing_seats}

    # Add or update seats
    for seat_spec in computed_layout["custom_seats"]:
        key = (seat_spec["row_label"], seat_spec["seat_number"])
        if key in existing_lookup:
            # Update tier
            existing_lookup[key].tier = seat_spec["tier"]
        else:
            # Insert new seat
            new_seat = Seat(
                screen_id=screen_id,
                row_label=seat_spec["row_label"],
                seat_number=seat_spec["seat_number"],
                tier=seat_spec["tier"]
            )
            db.add(new_seat)

    # Delete unbooked seats that are not in the new layout
    for key, seat_obj in existing_lookup.items():
        if key not in new_seat_keys and key not in booked_seat_keys:
            db.delete(seat_obj)

    # 4. Update screen properties
    if screen_name:
        screen.name = screen_name
    screen.total_seats = len(computed_layout["custom_seats"])
    screen.layout_config = json.dumps(computed_layout)

    db.commit()
    db.refresh(screen)
    return screen


def create_demo_classroom_theatre(db: Session, req: DemoClassroomPresetRequest) -> Dict[str, Any]:
    """
    Creates or reconfigures the College Demo Theatre and Screen 1
    with 5 rows (A-E), 6 seats per row, central aisle between 3 & 4.
    Also ensures an active demo show is available for immediate end-to-end booking & navigation testing.
    """
    # 1. Create or retrieve Demo Theatre
    theatre = db.query(Theatre).filter(Theatre.name == req.theatre_name).first()
    if not theatre:
        theatre = Theatre(
            name=req.theatre_name,
            city=req.city,
            address=req.address,
            formats="2D,Classroom HD",
            is_demo=True,
            description=req.description,
        )
        db.add(theatre)
        db.commit()
        db.refresh(theatre)
    else:
        theatre.is_demo = True
        theatre.description = req.description
        theatre.city = req.city
        theatre.address = req.address
        db.commit()

    # 2. Create or retrieve Screen 1
    screen = db.query(Screen).filter(
        Screen.theatre_id == theatre.id,
        Screen.screen_number == 1
    ).first()

    if not screen:
        screen = Screen(
            theatre_id=theatre.id,
            screen_number=1,
            name=req.screen_name,
            total_seats=req.num_rows * req.seats_per_row
        )
        db.add(screen)
        db.commit()
        db.refresh(screen)

    # 3. Build classroom layout specification
    row_chars = [chr(65 + i) for i in range(req.num_rows)]  # ["A", "B", "C", "D", "E"]
    layout_spec = {
        "rows": row_chars,
        "seats_per_row": req.seats_per_row,
        "aisle_after_seat": req.aisle_after_seat,
        "side_aisles": True,
        "screen_position": "FRONT",
        "entrance_position": "BACK_CENTER",
        "exit_position": "FRONT_LEFT",
        "is_demo_preset": True,
        "preset_name": "College Demo Classroom (Seminar Hall 101)",
    }

    save_screen_layout_config(db, screen.id, layout_spec, screen_name=req.screen_name)

    # 4. Ensure an active Show exists for this screen with a movie so it can be booked & navigated right away
    existing_show = db.query(Show).filter(
        Show.screen_id == screen.id,
        Show.show_time >= datetime.utcnow()
    ).first()

    if not existing_show:
        first_movie = db.query(Movie).first()
        if first_movie:
            demo_show = Show(
                movie_id=first_movie.id,
                theatre_id=theatre.id,
                screen_id=screen.id,
                show_time=datetime.utcnow() + timedelta(hours=2),
                screen_format="2D",
                silver_price=150.0,
                gold_price=220.0,
                platinum_price=300.0
            )
            db.add(demo_show)
            db.commit()
            db.refresh(demo_show)
            show_id = demo_show.id
        else:
            show_id = None
    else:
        show_id = existing_show.id

    return {
        "theatre_id": theatre.id,
        "theatre_name": theatre.name,
        "is_demo": theatre.is_demo,
        "screen_id": screen.id,
        "screen_name": screen.name,
        "total_seats": screen.total_seats,
        "demo_show_id": show_id,
        "message": f"Successfully configured '{theatre.name}' with {screen.name} (5 Rows x 6 Seats) for classroom demo."
    }
