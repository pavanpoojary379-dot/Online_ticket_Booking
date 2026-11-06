import math
import heapq
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.booking import Booking, BookingSeat
from app.models.show import Show
from app.models.screen import Screen
from app.models.theatre import Theatre
from app.models.seat import Seat
from app.models.navigation import NavigationSession
from app.schemas.navigation import (
    NavigationBookingInfoResponse,
    ScreenMapResponse,
    SeatCoordinate,
    NavigationSessionResponse,
    CompleteSessionResponse,
)

# Layout constants (Normalized 0 - 100 space)
SCREEN_BOUNDS = {"width": 100.0, "height": 100.0}

# Proximity thresholds
THRESHOLD_SEAT_REACHED = 3.5          # Within ~1.2 meters of seat
THRESHOLD_APPROACHING_SEAT = 5.0      # Within ~1.8 meters of seat
THRESHOLD_ENTERED_ROW_Y = 3.0         # Vertically inside the row lane
THRESHOLD_APPROACHING_ROW_Y = 7.5     # Within 1-2 row distances of target row

def generate_screen_blueprint(db: Session, screen_id: int, booked_seat_ids: Optional[Set[int]] = None) -> ScreenMapResponse:
    """
    Generates a dynamic 2D top-view cinema blueprint from the database screen and seat records,
    prioritizing custom layout configurations (e.g. for seminar rooms and classrooms).
    """
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail=f"Screen with ID {screen_id} not found.")

    seats = db.query(Seat).filter(Seat.screen_id == screen_id).order_by(Seat.row_label, Seat.seat_number).all()
    if not seats:
        raise HTTPException(status_code=404, detail="No seats found for this screen.")

    user_booked_set = booked_seat_ids or set()

    # Check for custom layout configuration (e.g. classroom demonstration)
    custom_cfg = None
    if screen.layout_config:
        try:
            custom_cfg = json.loads(screen.layout_config)
        except Exception:
            custom_cfg = None

    if custom_cfg and "custom_seats" in custom_cfg:
        custom_lookup = {
            (cs["row_label"], cs["seat_number"]): cs
            for cs in custom_cfg["custom_seats"]
        }
        row_positions = custom_cfg.get("row_positions") or {}
        row_labels = custom_cfg.get("rows") or sorted(list({s.row_label for s in seats}))
        aisles = custom_cfg.get("aisles") or []
        entrance = custom_cfg.get("entrance") or {
            "label": "Auditorium Main Entrance",
            "x": 50.0,
            "y": 95.0,
            "width": 12.0,
            "height": 4.0,
        }
        exit_elem = custom_cfg.get("exit") or {
            "label": "Emergency Exit",
            "x": 8.0,
            "y": 16.0,
            "width": 8.0,
            "height": 4.0,
        }
        screen_element = custom_cfg.get("screen_element") or {
            "label": f"{screen.name} - Screen",
            "x1": 15.0,
            "x2": 85.0,
            "y": 7.0,
            "curvature": 25.0,
        }
        checkpoints = custom_cfg.get("checkpoints") or []

        seat_coords: List[SeatCoordinate] = []
        for s in seats:
            cs = custom_lookup.get((s.row_label, s.seat_number))
            if cs:
                x_val = cs["x"]
                y_val = cs["y"]
                is_acc = cs.get("is_accessible", False)
            else:
                x_val = 50.0
                y_val = row_positions.get(s.row_label, 50.0)
                is_acc = False

            coord = SeatCoordinate(
                id=s.id,
                row_label=s.row_label,
                seat_number=s.seat_number,
                label=f"{s.row_label}{s.seat_number}",
                tier=s.tier,
                x=round(x_val, 2),
                y=round(y_val, 2),
                is_accessible=is_acc,
                is_booked_by_user=(s.id in user_booked_set),
            )
            seat_coords.append(coord)

        return ScreenMapResponse(
            screen_id=screen.id,
            screen_name=screen.name,
            screen_format="Classroom Layout" if (screen.theatre and screen.theatre.is_demo) else ("IMAX Laser" if "IMAX" in screen.name else "Dolby Atmos"),
            theatre_name=screen.theatre.name if screen.theatre else "CineBook Cinemas",
            dimensions=SCREEN_BOUNDS,
            screen_element=screen_element,
            entrance=entrance,
            exit=exit_elem,
            aisles=aisles,
            seats=seat_coords,
            rows=row_labels,
            row_positions=row_positions,
            checkpoints=checkpoints,
        )

    # Standard / Default Cinema Blueprint Generation
    row_labels = sorted(list({s.row_label for s in seats}))
    num_rows = len(row_labels)

    # Calculate row vertical positions (y: 24.0 at front down to 82.0 at rear)
    row_positions = {}
    for idx, r in enumerate(row_labels):
        if num_rows <= 1:
            y_pos = 50.0
        else:
            y_pos = 24.0 + idx * ((82.0 - 24.0) / (num_rows - 1))
        row_positions[r] = round(y_pos, 2)

    # Calculate seat horizontal positions
    seat_coords: List[SeatCoordinate] = []
    max_seat_num = max([s.seat_number for s in seats], default=10)
    split_point = max(1, max_seat_num // 2)

    for s in seats:
        y_val = row_positions[s.row_label]
        if s.seat_number <= split_point:
            # Left wing
            x_val = 14.0 + (s.seat_number - 1) * ((44.0 - 14.0) / max(1, split_point - 1))
        else:
            # Right wing
            remaining = max(1, max_seat_num - split_point - 1)
            x_val = 56.0 + (s.seat_number - split_point - 1) * ((86.0 - 56.0) / remaining)

        is_acc = s.row_label in [row_labels[0], row_labels[-1]] and s.seat_number in [1, max_seat_num]
        coord = SeatCoordinate(
            id=s.id,
            row_label=s.row_label,
            seat_number=s.seat_number,
            label=f"{s.row_label}{s.seat_number}",
            tier=s.tier,
            x=round(x_val, 2),
            y=round(y_val, 2),
            is_accessible=is_acc,
            is_booked_by_user=(s.id in user_booked_set),
        )
        seat_coords.append(coord)

    # Aisles definitions for visualization
    aisles = [
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
            "id": "left_aisle",
            "name": "Left Side Aisle",
            "type": "VERTICAL",
            "x": 8.0,
            "width": 6.0,
            "y1": 16.0,
            "y2": 89.0,
        },
        {
            "id": "right_aisle",
            "name": "Right Side Aisle",
            "type": "VERTICAL",
            "x": 92.0,
            "width": 6.0,
            "y1": 16.0,
            "y2": 89.0,
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
            "y": 89.0,
            "height": 8.0,
            "x1": 8.0,
            "x2": 92.0,
        },
    ]

    checkpoints = [
        {
            "id": "entrance",
            "label": "1. Auditorium Entrance",
            "description": "Just stepped through the main entrance doors",
            "x": 50.0,
            "y": 95.0,
            "status": "ENTERING_AUDITORIUM",
        },
        {
            "id": "main_aisle",
            "label": "2. Main Central Aisle",
            "description": "Standing in the central aisle concourse",
            "x": 50.0,
            "y": 89.0,
            "status": "MOVING_TO_ROW",
        },
        {
            "id": "mid_auditorium",
            "label": "3. Central Corridor",
            "description": "Walking along the center towards your row",
            "x": 50.0,
            "y": 57.0,
            "status": "APPROACHING_ROW",
        },
    ]

    return ScreenMapResponse(
        screen_id=screen.id,
        screen_name=screen.name,
        screen_format="IMAX Laser" if "IMAX" in screen.name else "Dolby Atmos",
        theatre_name=screen.theatre.name if screen.theatre else "CineBook Cinemas",
        dimensions=SCREEN_BOUNDS,
        screen_element={
            "label": f"{screen.name} - Screen",
            "x1": 15.0,
            "x2": 85.0,
            "y": 7.0,
            "curvature": 25.0,
        },
        entrance={
            "label": "Auditorium Main Entrance",
            "x": 50.0,
            "y": 95.0,
            "width": 12.0,
            "height": 4.0,
        },
        exit={
            "label": "Emergency Exit",
            "x": 8.0,
            "y": 16.0,
            "width": 8.0,
            "height": 4.0,
        },
        aisles=aisles,
        seats=seat_coords,
        rows=row_labels,
        row_positions=row_positions,
        checkpoints=checkpoints,
    )


def get_screen_layout_params(screen: Screen) -> Tuple[int, float, Tuple[float, float]]:
    """
    Returns (aisle_split_seat, aisle_x, (entrance_x, entrance_y)) for the given screen.
    Defaults to 50.0 center, split at half seat count, entrance at (50.0, 95.0).
    """
    if screen.layout_config:
        try:
            cfg = json.loads(screen.layout_config)
            split = cfg.get("aisle_after_seat", 5)
            entrance_data = cfg.get("entrance", {})
            ent_x = entrance_data.get("x", 50.0)
            ent_y = entrance_data.get("y", 95.0)
            aisles = cfg.get("aisles", [])
            aisle_x = 50.0
            for a in aisles:
                if a.get("id") == "central_aisle" and a.get("x") is not None:
                    aisle_x = float(a["x"])
                    break
            return int(split), aisle_x, (float(ent_x), float(ent_y))
        except Exception:
            pass

    max_seat = max([s.seat_number for s in screen.seats], default=10)
    return max(1, max_seat // 2), 50.0, (50.0, 95.0)


def build_walkable_graph(
    row_positions: Dict[str, float],
    aisle_x: float = 50.0,
    entrance_pos: Tuple[float, float] = (50.0, 95.0)
) -> Tuple[Dict[str, Tuple[float, float]], Dict[str, List[str]]]:
    """
    Builds an aisle waypoint graph for A* navigation pathfinding.
    Nodes are walkable intersections; edges are accessible corridors.
    """
    nodes: Dict[str, Tuple[float, float]] = {
        "entrance": entrance_pos,
        "rear_center": (aisle_x, 89.0),
        "rear_left": (8.0, 89.0),
        "rear_right": (92.0, 89.0),
        "front_center": (aisle_x, 16.0),
        "front_left": (8.0, 16.0),
        "front_right": (92.0, 16.0),
    }

    edges: Dict[str, List[str]] = {
        "entrance": ["rear_center"],
        "rear_center": ["entrance", "rear_left", "rear_right"],
        "rear_left": ["rear_center"],
        "rear_right": ["rear_center"],
        "front_center": ["front_left", "front_right"],
        "front_left": ["front_center"],
        "front_right": ["front_center"],
    }

    # Connect central, left, right vertical corridors through all rows
    sorted_rows = sorted(row_positions.keys(), key=lambda r: row_positions[r])

    prev_c = "front_center"
    prev_l = "front_left"
    prev_r = "front_right"

    for r in sorted_rows:
        y = row_positions[r]
        node_c = f"c_{r}"
        node_l = f"l_{r}"
        node_r = f"r_{r}"
        entry_left = f"entry_left_{r}"
        entry_right = f"entry_right_{r}"

        nodes[node_c] = (aisle_x, y)
        nodes[node_l] = (8.0, y)
        nodes[node_r] = (92.0, y)
        nodes[entry_left] = (aisle_x - 5.0, y)
        nodes[entry_right] = (aisle_x + 5.0, y)

        # Initialize lists
        for n in [node_c, node_l, node_r, entry_left, entry_right]:
            edges.setdefault(n, [])

        # Vertical links
        edges[prev_c].append(node_c)
        edges[node_c].append(prev_c)

        edges[prev_l].append(node_l)
        edges[node_l].append(prev_l)

        edges[prev_r].append(node_r)
        edges[node_r].append(prev_r)

        # Row entry links from center
        edges[node_c].extend([entry_left, entry_right])
        edges[entry_left].append(node_c)
        edges[entry_right].append(node_c)

        prev_c = node_c
        prev_l = node_l
        prev_r = node_r

    # Link bottom row nodes to rear concourse
    edges[prev_c].append("rear_center")
    edges["rear_center"].append(prev_c)

    edges[prev_l].append("rear_left")
    edges["rear_left"].append(prev_l)

    edges[prev_r].append("rear_right")
    edges["rear_right"].append(prev_r)

    return nodes, edges


def calculate_astar_route(
    start: Tuple[float, float],
    target_seat: Dict[str, Any],
    row_positions: Dict[str, float],
    aisle_split_seat: int = 5,
    aisle_x: float = 50.0,
    entrance_pos: Tuple[float, float] = (50.0, 95.0)
) -> Tuple[List[Dict[str, float]], float, List[str]]:
    """
    Computes the shortest obstacle-free route from current position to target seat using A*.
    """
    nodes, edges = build_walkable_graph(row_positions, aisle_x=aisle_x, entrance_pos=entrance_pos)

    # 1. Connect start point to nearest aisle node
    best_start_node = None
    min_start_dist = float("inf")
    for n_id, n_pos in nodes.items():
        d = math.hypot(start[0] - n_pos[0], start[1] - n_pos[1])
        if d < min_start_dist:
            min_start_dist = d
            best_start_node = n_id

    # 2. Identify target row entry node
    row_char = target_seat["row_label"]
    seat_num = target_seat["seat_number"]
    target_entry_node = f"entry_left_{row_char}" if seat_num <= aisle_split_seat else f"entry_right_{row_char}"
    if target_entry_node not in nodes:
        target_entry_node = f"c_{row_char}" if f"c_{row_char}" in nodes else "rear_center"

    target_pos = (target_seat["x"], target_seat["y"])

    # 3. A* Search
    open_set = []
    heapq.heappush(open_set, (0.0, best_start_node))
    came_from: Dict[str, str] = {}
    g_score: Dict[str, float] = {best_start_node: 0.0}

    def heuristic(node_id: str) -> float:
        pos = nodes[node_id]
        return math.hypot(pos[0] - target_pos[0], pos[1] - target_pos[1])

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == target_entry_node:
            break

        for neighbor in edges.get(current, []):
            cost = math.hypot(nodes[current][0] - nodes[neighbor][0], nodes[current][1] - nodes[neighbor][1])
            tentative_g = g_score[current] + cost
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor)
                heapq.heappush(open_set, (f_score, neighbor))

    # Reconstruct path
    path = []
    curr = target_entry_node
    while curr in came_from:
        path.append(curr)
        curr = came_from[curr]
    if best_start_node:
        path.append(best_start_node)
    path.reverse()

    # Build coordinate route points
    route: List[Dict[str, float]] = [{"x": round(start[0], 2), "y": round(start[1], 2)}]

    for n_id in path:
        pt = nodes[n_id]
        # Avoid duplicate points
        if not route or abs(route[-1]["x"] - pt[0]) > 0.5 or abs(route[-1]["y"] - pt[1]) > 0.5:
            route.append({"x": round(pt[0], 2), "y": round(pt[1], 2)})

    # Final segment to the exact seat
    route.append({"x": round(target_seat["x"], 2), "y": round(target_seat["y"], 2)})

    # Calculate total route distance in units
    total_dist = 0.0
    for idx in range(len(route) - 1):
        total_dist += math.hypot(route[idx + 1]["x"] - route[idx]["x"], route[idx + 1]["y"] - route[idx]["y"])

    # Generate turn-by-turn directional instructions
    instructions = []
    is_left = target_seat["seat_number"] <= aisle_split_seat

    if abs(start[1] - target_seat["y"]) > 10.0:
        instructions.append("Walk along the Central Aisle towards the screen.")
        instructions.append(f"Continue until you reach Row {row_char}.")
    elif abs(start[1] - target_seat["y"]) > THRESHOLD_ENTERED_ROW_Y:
        instructions.append(f"You are right next to Row {row_char}.")
        instructions.append(f"Turn {'left' if is_left else 'right'} into Row {row_char}.")
    else:
        instructions.append(f"Move along Row {row_char} to Seat {target_seat['label']}.")

    return route, round(total_dist, 2), instructions


def evaluate_navigation_state(
    current_x: float,
    current_y: float,
    target_seat: Dict[str, Any],
    row_positions: Dict[str, float],
    aisle_split_seat: int = 5,
    aisle_x: float = 50.0
) -> Tuple[str, str, bool, bool]:
    """
    Evaluates current position against target seat and row to determine state machine status.
    Returns: (status, message, is_target_row_active, is_seat_reached)
    """
    target_x = target_seat["x"]
    target_y = target_seat["y"]
    row_char = target_seat["row_label"]
    seat_label = target_seat["label"]
    seat_num = target_seat["seat_number"]

    dist_to_seat = math.hypot(current_x - target_x, current_y - target_y)
    y_diff_to_row = abs(current_y - target_y)

    # State 6: SEAT_REACHED
    if dist_to_seat <= THRESHOLD_SEAT_REACHED:
        return (
            "SEAT_REACHED",
            f"You have reached your seat – {seat_label}. Enjoy your movie!",
            True,
            True,
        )

    # State 5: APPROACHING_SEAT
    if dist_to_seat <= THRESHOLD_APPROACHING_SEAT and y_diff_to_row <= THRESHOLD_ENTERED_ROW_Y:
        return (
            "APPROACHING_SEAT",
            f"You are very close to your seat {seat_label}.",
            True,
            False,
        )

    # State 4: ENTERED_TARGET_ROW
    # User is vertically aligned with the target row and has entered the seating aisle
    in_seating_lane = (seat_num <= aisle_split_seat and current_x <= (aisle_x - 2.0)) or (seat_num > aisle_split_seat and current_x >= (aisle_x + 2.0))
    if y_diff_to_row <= THRESHOLD_ENTERED_ROW_Y and in_seating_lane:
        return (
            "ENTERED_TARGET_ROW",
            f"You are in Row {row_char}. Find Seat {seat_num}.",
            True,
            False,
        )

    # State 3: APPROACHING_ROW
    if y_diff_to_row <= THRESHOLD_APPROACHING_ROW_Y:
        return (
            "APPROACHING_ROW",
            f"You are approaching Row {row_char}.",
            True,  # Target row turns GREEN!
            False,
        )

    # State 2: MOVING_TO_ROW
    if current_y <= 88.0:
        return (
            "MOVING_TO_ROW",
            f"Walking along the aisle towards Row {row_char}.",
            False,
            False,
        )

    # State 1: ENTERING_AUDITORIUM
    return (
        "ENTERING_AUDITORIUM",
        "Entering auditorium. Head forward to the central aisle.",
        False,
        False,
    )


def get_navigation_booking_info(db: Session, booking_id: int, user_id: int, is_admin: bool = False) -> NavigationBookingInfoResponse:
    """
    Validates and fetches confirmed booking details for navigation session startup.
    Security: Only owner of the booking or admin can access.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking #{booking_id} not found.")

    if not is_admin and booking.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only navigate to your own bookings."
        )

    if booking.status != "CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Navigation is only available for CONFIRMED bookings. Current status is '{booking.status}'."
        )

    show = booking.show
    if not show:
        raise HTTPException(status_code=404, detail="Show information missing for this booking.")

    # Get booked seats
    bs_records = db.query(BookingSeat).filter(BookingSeat.booking_id == booking_id).all()
    if not bs_records:
        raise HTTPException(status_code=400, detail="No seats registered under this booking.")

    booked_seats_info = []
    default_seat_id = bs_records[0].seat_id

    for bs in bs_records:
        s = bs.seat
        if s:
            booked_seats_info.append({
                "seat_id": s.id,
                "label": f"{s.row_label}{s.seat_number}",
                "row_label": s.row_label,
                "seat_number": s.seat_number,
                "tier": s.tier,
                "price": bs.price,
            })

    return NavigationBookingInfoResponse(
        booking_id=booking.id,
        booking_code=booking.booking_code,
        movie_title=show.movie.title if show.movie else "Cinema Movie",
        movie_poster=show.movie.poster_url if show.movie else None,
        theatre_name=show.theatre.name if show.theatre else "CineBook Theatre",
        theatre_city=show.theatre.city if show.theatre else "City",
        screen_id=show.screen_id,
        screen_name=show.screen.name if show.screen else "Audi 1",
        screen_format=show.screen_format,
        show_time=show.show_time,
        booked_seats=booked_seats_info,
        default_seat_id=default_seat_id,
    )


def start_or_resume_session(
    db: Session,
    booking_id: int,
    user_id: int,
    target_seat_id: Optional[int] = None,
    is_admin: bool = False
) -> NavigationSessionResponse:
    """
    Starts a new navigation session or restores an active one for the booking.
    """
    # 1. Validate booking
    booking_info = get_navigation_booking_info(db, booking_id, user_id, is_admin)

    # 2. Select target seat
    valid_seat_ids = [s["seat_id"] for s in booking_info.booked_seats]
    selected_target_id = target_seat_id if target_seat_id in valid_seat_ids else valid_seat_ids[0]

    target_seat_obj = db.query(Seat).filter(Seat.id == selected_target_id).first()
    if not target_seat_obj:
        raise HTTPException(status_code=404, detail="Target seat not found.")

    # 3. Check for existing active session for this user and booking
    existing = db.query(NavigationSession).filter(
        NavigationSession.user_id == user_id,
        NavigationSession.booking_id == booking_id,
        NavigationSession.completed_at == None,
    ).order_by(NavigationSession.id.desc()).first()

    if existing:
        session = existing
        # If target seat was changed
        if selected_target_id != session.target_seat_id:
            session.target_seat_id = selected_target_id
            db.commit()
    else:
        # Create new navigation session
        session = NavigationSession(
            session_id=f"NAV-{uuid.uuid4().hex[:10].upper()}",
            user_id=user_id,
            booking_id=booking_id,
            show_id=booking_info.screen_id,  # references show
            screen_id=booking_info.screen_id,
            target_seat_id=selected_target_id,
            current_x=50.0,
            current_y=95.0,  # Starts at Auditorium entrance
            navigation_status="ENTERING_AUDITORIUM",
            positioning_source="SIMULATION",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # 4. Generate blueprint to compute route and state
    screen_map = generate_screen_blueprint(db, booking_info.screen_id, set(valid_seat_ids))
    target_coord = next(s for s in screen_map.seats if s.id == selected_target_id)
    target_dict = target_coord.model_dump()

    screen_obj = db.query(Screen).filter(Screen.id == booking_info.screen_id).first()
    split_seat, aisle_x, ent_pos = get_screen_layout_params(screen_obj) if screen_obj else (5, 50.0, (50.0, 95.0))

    # Route & State
    route, dist_units, instructions = calculate_astar_route(
        start=(session.current_x, session.current_y),
        target_seat=target_dict,
        row_positions=screen_map.row_positions,
        aisle_split_seat=split_seat,
        aisle_x=aisle_x,
        entrance_pos=ent_pos,
    )

    status_str, message_str, is_row_active, is_reached = evaluate_navigation_state(
        current_x=session.current_x,
        current_y=session.current_y,
        target_seat=target_dict,
        row_positions=screen_map.row_positions,
        aisle_split_seat=split_seat,
        aisle_x=aisle_x,
    )

    session.navigation_status = status_str
    db.commit()

    return NavigationSessionResponse(
        session_id=session.session_id,
        booking_id=session.booking_id,
        show_id=booking_info.screen_id,
        screen_id=booking_info.screen_id,
        target_seat_id=selected_target_id,
        target_seat_label=target_coord.label,
        current_x=session.current_x,
        current_y=session.current_y,
        navigation_status=status_str,
        status_message=message_str,
        route=route,
        remaining_distance=round(dist_units * 0.35, 1),
        remaining_steps=int(dist_units * 0.5),
        current_instruction=instructions[0] if instructions else "Follow the marked pathway to your seat.",
        positioning_source=session.positioning_source,
        is_target_row_active=is_row_active,
        is_seat_reached=is_reached,
    )


def update_session_location(
    db: Session,
    session_id: str,
    x: float,
    y: float,
    user_id: int,
    source: str = "SIMULATION",
    is_admin: bool = False
) -> NavigationSessionResponse:
    """
    Updates user position inside the auditorium and recalculates route and status.
    """
    session = db.query(NavigationSession).filter(NavigationSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Navigation session not found.")

    if not is_admin and session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to navigation session.")

    # Clamp coordinates to cinema hall bounds
    clamped_x = max(2.0, min(98.0, x))
    clamped_y = max(10.0, min(98.0, y))

    session.current_x = clamped_x
    session.current_y = clamped_y
    session.positioning_source = source

    # Fetch screen blueprint & target seat
    screen_map = generate_screen_blueprint(db, session.screen_id)
    target_coord = next((s for s in screen_map.seats if s.id == session.target_seat_id), None)
    if not target_coord:
        raise HTTPException(status_code=404, detail="Target seat no longer exists.")

    target_dict = target_coord.model_dump()

    screen_obj = db.query(Screen).filter(Screen.id == session.screen_id).first()
    split_seat, aisle_x, ent_pos = get_screen_layout_params(screen_obj) if screen_obj else (5, 50.0, (50.0, 95.0))

    # Calculate real-time route
    route, dist_units, instructions = calculate_astar_route(
        start=(clamped_x, clamped_y),
        target_seat=target_dict,
        row_positions=screen_map.row_positions,
        aisle_split_seat=split_seat,
        aisle_x=aisle_x,
        entrance_pos=ent_pos,
    )

    # Evaluate dynamic status
    status_str, message_str, is_row_active, is_reached = evaluate_navigation_state(
        current_x=clamped_x,
        current_y=clamped_y,
        target_seat=target_dict,
        row_positions=screen_map.row_positions,
        aisle_split_seat=split_seat,
        aisle_x=aisle_x,
    )

    session.navigation_status = status_str
    if is_reached and not session.completed_at:
        session.completed_at = datetime.utcnow()

    db.commit()

    return NavigationSessionResponse(
        session_id=session.session_id,
        booking_id=session.booking_id,
        show_id=session.show_id,
        screen_id=session.screen_id,
        target_seat_id=session.target_seat_id,
        target_seat_label=target_coord.label,
        current_x=session.current_x,
        current_y=session.current_y,
        navigation_status=status_str,
        status_message=message_str,
        route=route,
        remaining_distance=round(dist_units * 0.35, 1),
        remaining_steps=int(dist_units * 0.5),
        current_instruction=instructions[0] if instructions else "Follow the marked pathway to your seat.",
        positioning_source=session.positioning_source,
        is_target_row_active=is_row_active,
        is_seat_reached=is_reached,
    )


def complete_session(
    db: Session,
    session_id: str,
    user_id: int,
    is_admin: bool = False
) -> CompleteSessionResponse:
    """
    Marks the navigation session as completed.
    """
    session = db.query(NavigationSession).filter(NavigationSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Navigation session not found.")

    if not is_admin and session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to navigation session.")

    now = datetime.utcnow()
    session.completed_at = now
    session.navigation_status = "SEAT_REACHED"
    db.commit()

    return CompleteSessionResponse(
        session_id=session.session_id,
        status="COMPLETED",
        message="Navigation session completed successfully. Enjoy your movie!",
        completed_at=now,
    )

