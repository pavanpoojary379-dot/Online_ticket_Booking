from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.show import Show
from app.models.seat import Seat
from app.models.theatre import Theatre
from app.models.screen import Screen
from app.models.movie import Movie
from app.services.booking_service import cleanup_expired_locks, get_seat_layout_with_status
from app.schemas.recommendation import (
    SeatRecommendationRequest,
    SeatRecommendationsResponse,
    SeatRecommendationItem,
    SeatScoreBreakdown,
    ShowPreferencesResponse,
    TierPreferenceInfo,
)
from app.schemas.show import SeatOut

# Default Configurable Weights
DEFAULT_WEIGHTS = {
    "central_position": 0.35,
    "viewing_distance": 0.25,
    "adjacent_seating": 0.25,
    "budget_preference": 0.15,
}

PREFERENCE_WEIGHTS_MAP = {
    "best_view": {
        "central_position": 0.35,
        "viewing_distance": 0.25,
        "adjacent_seating": 0.25,
        "budget_preference": 0.15,
    },
    "centre": {
        "central_position": 0.45,
        "viewing_distance": 0.20,
        "adjacent_seating": 0.20,
        "budget_preference": 0.15,
    },
    "front": {
        "central_position": 0.25,
        "viewing_distance": 0.40,
        "adjacent_seating": 0.20,
        "budget_preference": 0.15,
    },
    "back": {
        "central_position": 0.25,
        "viewing_distance": 0.40,
        "adjacent_seating": 0.20,
        "budget_preference": 0.15,
    },
    "adjacent": {
        "central_position": 0.25,
        "viewing_distance": 0.20,
        "adjacent_seating": 0.40,
        "budget_preference": 0.15,
    },
}

SEATING_PREFERENCE_OPTIONS = [
    {"value": "best_view", "label": "Best Overall View (Recommended)", "description": "Optimal central acoustic and visual sweet spot"},
    {"value": "centre", "label": "Centre Seats", "description": "Direct center horizontal alignment with cinema screen"},
    {"value": "front", "label": "Front Seats", "description": "Close-up immersive viewing experience"},
    {"value": "back", "label": "Back Seats", "description": "Elevated panoramic rear viewing & extra comfort"},
    {"value": "adjacent", "label": "Adjacent Seats Priority", "description": "Prioritize keeping group members strictly side-by-side"},
]


def get_show_preferences(db: Session, show_id: int) -> ShowPreferencesResponse:
    """
    Returns available preference options, tier pricing, and availability counts for a show.
    """
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail=f"Show with ID {show_id} not found.")

    layout = get_seat_layout_with_status(db, show_id)
    total_seats = len(layout)
    available_seats = [s for s in layout if s["status"] == "AVAILABLE"]
    avail_count = len(available_seats)

    # Calculate per-tier counts and prices
    tier_map = {
        "SILVER": {"label": "Silver Classic", "price": show.silver_price, "available_count": 0},
        "GOLD": {"label": "Gold Prime", "price": show.gold_price, "available_count": 0},
        "PLATINUM": {"label": "Platinum Recliner", "price": show.platinum_price, "available_count": 0},
    }

    for s in available_seats:
        t = s["tier"].upper()
        if t in tier_map:
            tier_map[t]["available_count"] += 1

    tiers = [
        TierPreferenceInfo(
            name=name,
            label=info["label"],
            price=info["price"],
            available_count=info["available_count"],
        )
        for name, info in tier_map.items()
    ]

    all_prices = [show.silver_price, show.gold_price, show.platinum_price]

    return ShowPreferencesResponse(
        show_id=show.id,
        movie_title=show.movie.title if show.movie else "Cinema Feature",
        theatre_name=show.theatre.name if show.theatre else "Multiplex",
        screen_name=show.screen.name if show.screen else "Audi",
        screen_format=show.screen_format,
        available_seats_count=avail_count,
        total_seats_count=total_seats,
        tiers=tiers,
        min_price=min(all_prices),
        max_price=max(all_prices),
        seating_preferences=SEATING_PREFERENCE_OPTIONS,
        max_tickets_allowed=10,
    )


def calculate_central_score(combo: List[dict], row_lengths: Dict[str, int]) -> float:
    """
    Scores central horizontal position (0 to 100).
    Higher score for seats positioned near the center of the row.
    """
    scores = []
    for s in combo:
        row_len = row_lengths.get(s["row_label"], 10)
        center = (row_len + 1) / 2.0
        max_dist = max(1.0, (row_len - 1) / 2.0)
        dist = abs(s["seat_number"] - center)
        norm_dist = min(1.0, dist / max_dist)
        seat_score = 100.0 * (1.0 - norm_dist)
        scores.append(seat_score)

    return round(sum(scores) / len(scores), 2)


def calculate_viewing_distance_score(
    combo: List[dict],
    sorted_row_labels: List[str],
    preference: str
) -> float:
    """
    Scores vertical distance from screen (0 to 100).
    Prefers middle rows (sweet spot) by default, or front/back when explicitly requested.
    Row 0 (e.g. 'A') is closest to the screen, row N-1 (e.g. 'F') is rear.
    """
    total_rows = len(sorted_row_labels)
    if total_rows <= 1:
        return 100.0

    scores = []
    for s in combo:
        try:
            row_idx = sorted_row_labels.index(s["row_label"])
        except ValueError:
            row_idx = total_rows // 2

        if preference == "front":
            # Prefer rows closest to screen: index 0 is 100, index N-1 is ~30
            rel = row_idx / (total_rows - 1)
            score = 100.0 - (rel * 70.0)
        elif preference == "back":
            # Prefer rows farthest from screen: index N-1 is 100, index 0 is ~30
            rel = (total_rows - 1 - row_idx) / (total_rows - 1)
            score = 100.0 - (rel * 70.0)
        else:
            # "best_view", "centre", "adjacent": prefer middle sweet spot (45% - 65% depth)
            sweet_spot = (total_rows - 1) * 0.55
            max_dist = max(sweet_spot, (total_rows - 1) - sweet_spot, 1.0)
            dist = abs(row_idx - sweet_spot)
            norm_dist = dist / max_dist
            base = 100.0 * (1.0 - 0.75 * norm_dist)

            # Neck strain penalty for extreme front row (Row index 0)
            if row_idx == 0:
                base = max(25.0, base - 25.0)

            score = max(20.0, min(100.0, base))

        scores.append(score)

    return round(sum(scores) / len(scores), 2)


def calculate_adjacent_score(combo: List[dict], requested_seats: int) -> float:
    """
    Scores adjacency (0 to 100).
    Single tickets get 100.
    Multi-ticket groups get 100 if consecutive in same row, reduced for gaps or multi-row splits.
    """
    if requested_seats <= 1:
        return 100.0

    rows_used = {s["row_label"] for s in combo}

    if len(rows_used) == 1:
        # All seats in one row
        numbers = sorted([s["seat_number"] for s in combo])
        span = max(numbers) - min(numbers) + 1
        gaps = span - len(numbers)

        if gaps == 0:
            return 100.0
        elif gaps == 1:
            return 75.0
        elif gaps == 2:
            return 55.0
        else:
            return max(30.0, 100.0 - (gaps * 20.0))
    elif len(rows_used) == 2:
        return 50.0
    else:
        return 25.0


def calculate_budget_score(combo: List[dict], max_budget: Optional[float]) -> float:
    """
    Scores budget compliance (0 to 100).
    If within budget, rewards good value (75 - 100).
    """
    if not max_budget or max_budget <= 0:
        return 100.0

    avg_price = sum(s["price"] for s in combo) / len(combo)
    if avg_price > max_budget:
        return 0.0

    # Within budget: ratio <= 1.0
    ratio = avg_price / max_budget
    score = 75.0 + 25.0 * (1.0 - ratio)
    return round(max(0.0, min(100.0, score)), 2)


def generate_explanations(
    combo: List[dict],
    central_score: float,
    distance_score: float,
    adjacent_score: float,
    budget_score: float,
    preference: str,
    max_budget: Optional[float]
) -> Tuple[List[str], str]:
    """
    Generates intelligent bulleted explanations and a summary string for the recommendation card.
    """
    explanations = []
    seat_count = len(combo)
    row_labels = sorted(list({s["row_label"] for s in combo}))
    row_str = ", ".join(row_labels)
    tier = combo[0]["tier"]
    price_per = combo[0]["price"]

    # 1. Central Position explanation
    if central_score >= 85:
        explanations.append(f"Prime centrally positioned seats with optimal screen sightlines (Center Score: {central_score:.0f}/100).")
    elif central_score >= 65:
        explanations.append(f"Balanced central viewing angle (Center Score: {central_score:.0f}/100).")
    else:
        explanations.append(f"Side-wing seating with angled screen perspective (Center Score: {central_score:.0f}/100).")

    # 2. Viewing Distance explanation
    if preference == "front":
        explanations.append(f"Requested front-row immersion in Row {row_str} close to the action.")
    elif preference == "back":
        explanations.append(f"Requested elevated rear-row positioning in Row {row_str} for panoramic view.")
    else:
        if distance_score >= 85:
            explanations.append(f"Auditorium sweet spot in Row {row_str} — comfortable viewing distance without neck strain.")
        else:
            explanations.append(f"Seated in Row {row_str} with good screen visibility.")

    # 3. Adjacency explanation
    if seat_count == 1:
        explanations.append("Prime single individual seat selected.")
    elif adjacent_score == 100.0:
        explanations.append(f"{seat_count} consecutive seats together in the same row.")
    else:
        explanations.append(f"{seat_count} seats arranged close together across Row {row_str}.")

    # 4. Budget & Value explanation
    total_price = sum(s["price"] for s in combo)
    if max_budget and max_budget > 0:
        explanations.append(f"{tier.capitalize()} tier at ₹{price_per:.0f}/ticket, comfortably within your budget of ₹{max_budget:.0f}.")
    else:
        explanations.append(f"{tier.capitalize()} tier priced at ₹{price_per:.0f} per ticket (Total: ₹{total_price:.0f}).")

    # Summary sentence
    summary_reason = f"{seat_count} {tier.capitalize()} seats in Row {row_str} with {central_score:.0f}% center alignment"

    return explanations, summary_reason


def recommend_seats_intelligent(db: Session, req: SeatRecommendationRequest) -> SeatRecommendationsResponse:
    """
    Main recommendation engine applying the weighted multi-factor rule-based algorithm.
    """
    show = db.query(Show).filter(Show.id == req.show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail=f"Show with ID {req.show_id} not found.")

    if req.number_of_seats < 1 or req.number_of_seats > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number of tickets must be between 1 and 10."
        )

    # 1. Clean up expired locks and fetch live seat layout
    cleanup_expired_locks(db)
    layout = get_seat_layout_with_status(db, req.show_id)

    # 2. Exclude already-booked and temporarily locked seats
    available_seats = [s for s in layout if s["status"] == "AVAILABLE"]
    if not available_seats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sold Out: No available seats remaining for this show."
        )

    if len(available_seats) < req.number_of_seats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient seats: Only {len(available_seats)} seat(s) available for this show, but {req.number_of_seats} were requested."
        )

    # All unique row labels in the auditorium screen (sorted: A, B, C, D, E, F...)
    all_rows = sorted(list({s["row_label"] for s in layout}))
    row_lengths = {}
    for s in layout:
        r = s["row_label"]
        row_lengths[r] = max(row_lengths.get(r, 0), s["seat_number"])

    # 3. Apply category filter
    pref_tier = req.preferred_category.upper() if req.preferred_category else "ANY"
    if pref_tier != "ANY":
        tier_seats = [s for s in available_seats if s["tier"].upper() == pref_tier]
        if not tier_seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No available seats found in the '{pref_tier}' category. Please select 'Any' category or try a different tier."
            )
        if len(tier_seats) < req.number_of_seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {len(tier_seats)} seat(s) available in '{pref_tier}' tier, but {req.number_of_seats} were requested."
            )
        candidate_pool = tier_seats
    else:
        candidate_pool = available_seats

    # 4. Apply budget filter
    all_prices = [s["price"] for s in candidate_pool]
    min_available_price = min(all_prices) if all_prices else show.silver_price

    if req.maximum_budget is not None and req.maximum_budget > 0:
        if req.maximum_budget < min_available_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your maximum budget of ₹{req.maximum_budget:.0f} is lower than the lowest available seat price (₹{min_available_price:.0f}) for this show."
            )
        candidate_pool = [s for s in candidate_pool if s["price"] <= req.maximum_budget]
        if len(candidate_pool) < req.number_of_seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough seats available within your budget of ₹{req.maximum_budget:.0f} per ticket. Try increasing your budget."
            )

    # 5. Generate seat combinations
    # Group candidate seats by row
    rows: Dict[str, List[dict]] = {}
    for s in candidate_pool:
        rows.setdefault(s["row_label"], []).append(s)

    for r in rows:
        rows[r].sort(key=lambda x: x["seat_number"])

    candidate_combos: List[List[dict]] = []

    k = req.number_of_seats

    if k == 1:
        # Every individual eligible seat is a candidate combo
        for r, row_seats in rows.items():
            for seat in row_seats:
                candidate_combos.append([seat])
    else:
        # Multi-ticket requests
        # A. Strictly adjacent contiguous sequences in the same row
        for r, row_seats in rows.items():
            if len(row_seats) >= k:
                for i in range(len(row_seats) - k + 1):
                    window = row_seats[i : i + k]
                    is_consecutive = all(
                        window[idx]["seat_number"] + 1 == window[idx + 1]["seat_number"]
                        for idx in range(k - 1)
                    )
                    if is_consecutive:
                        candidate_combos.append(window)

        # B. If adjacent_required is False and few/no adjacent combos exist, search near-adjacent or multi-row
        if not req.adjacent_required:
            if len(candidate_combos) < 5:
                # Same row with small gaps (gap <= 2)
                for r, row_seats in rows.items():
                    if len(row_seats) >= k:
                        for i in range(len(row_seats) - k + 1):
                            window = row_seats[i : i + k]
                            span = window[-1]["seat_number"] - window[0]["seat_number"] + 1
                            if span <= k + 2 and window not in candidate_combos:
                                candidate_combos.append(window)

                # Across 2 adjacent rows (e.g. split k in half)
                if len(candidate_combos) < 3:
                    sorted_row_keys = sorted(list(rows.keys()))
                    for idx in range(len(sorted_row_keys) - 1):
                        r1 = sorted_row_keys[idx]
                        r2 = sorted_row_keys[idx + 1]
                        seats1 = rows[r1]
                        seats2 = rows[r2]
                        half1 = k // 2
                        half2 = k - half1
                        if len(seats1) >= half1 and len(seats2) >= half2:
                            combo = seats1[:half1] + seats2[:half2]
                            candidate_combos.append(combo)

    # 6. Validate adjacency requirement
    if not candidate_combos:
        if req.adjacent_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No {k} adjacent seats could be found for your selected criteria. Try disabling the 'Adjacent seats required' option or selecting a different category."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No suitable seat combinations found matching your preferences. Please try adjusting your filters."
            )

    # 7. Score each candidate combination
    weights = PREFERENCE_WEIGHTS_MAP.get(req.seating_preference or "best_view", DEFAULT_WEIGHTS)

    scored_combos = []
    for combo in candidate_combos:
        c_score = calculate_central_score(combo, row_lengths)
        d_score = calculate_viewing_distance_score(combo, all_rows, req.seating_preference or "best_view")
        a_score = calculate_adjacent_score(combo, k)
        b_score = calculate_budget_score(combo, req.maximum_budget)

        final_score = (
            (weights["central_position"] * c_score)
            + (weights["viewing_distance"] * d_score)
            + (weights["adjacent_seating"] * a_score)
            + (weights["budget_preference"] * b_score)
        )
        # Ensure clamped between 0 and 100
        final_score = round(max(0.0, min(100.0, final_score)), 1)

        breakdown = SeatScoreBreakdown(
            central_position_score=c_score,
            viewing_distance_score=d_score,
            adjacent_seating_score=a_score,
            budget_score=b_score,
        )

        scored_combos.append({
            "combo": combo,
            "final_score": final_score,
            "breakdown": breakdown,
        })

    # 8. Sort descending by score
    scored_combos.sort(key=lambda x: x["final_score"], reverse=True)

    # 9. Pick top 3 diverse recommendations
    recommendations: List[SeatRecommendationItem] = []
    used_seat_ids: Set[int] = set()

    for item in scored_combos:
        combo = item["combo"]
        current_seat_ids = {s["id"] for s in combo}

        # Avoid exact duplicate combinations
        if any(set(r.seat_ids) == current_seat_ids for r in recommendations):
            continue

        rank = len(recommendations) + 1
        seat_labels = [f"{s['row_label']}{s['seat_number']}" for s in combo]
        row_names = sorted(list({s["row_label"] for s in combo}))
        row_str = ", ".join(row_names)
        tier_str = combo[0]["tier"]
        indiv_price = combo[0]["price"]
        total_price = sum(s["price"] for s in combo)

        # Convert to SeatOut
        seats_out = [
            SeatOut(
                id=s["id"],
                row_label=s["row_label"],
                seat_number=s["seat_number"],
                tier=s["tier"],
                price=s["price"],
                status=s["status"],
            )
            for s in combo
        ]

        explanations, summary_reason = generate_explanations(
            combo=combo,
            central_score=item["breakdown"].central_position_score,
            distance_score=item["breakdown"].viewing_distance_score,
            adjacent_score=item["breakdown"].adjacent_seating_score,
            budget_score=item["breakdown"].budget_score,
            preference=req.seating_preference or "best_view",
            max_budget=req.maximum_budget,
        )

        rec_item = SeatRecommendationItem(
            rank=rank,
            score=item["final_score"],
            seat_ids=[s["id"] for s in combo],
            seat_labels=seat_labels,
            seats=seats_out,
            seat_category=tier_str,
            row=row_str,
            individual_price=indiv_price,
            total_price=total_price,
            score_breakdown=item["breakdown"],
            explanation=explanations,
            summary_reason=summary_reason,
        )
        recommendations.append(rec_item)

        if len(recommendations) >= 3:
            break

    return SeatRecommendationsResponse(
        show_id=req.show_id,
        number_of_seats=req.number_of_seats,
        total_recommendations=len(recommendations),
        recommendations=recommendations,
        message=f"Found {len(recommendations)} personalized recommendation(s) matching your criteria.",
    )
