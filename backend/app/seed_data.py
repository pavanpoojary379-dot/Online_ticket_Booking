from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.movie import Movie
from app.models.theatre import Theatre
from app.models.screen import Screen
from app.models.show import Show
from app.models.seat import Seat
from app.models.coupon import Coupon
from app.utils.auth import get_password_hash

def seed_database(db: Session):
    # Check if data is already seeded
    if db.query(User).first():
        print("Database already contains data, skipping seeding.")
        return

    print("Seeding CineBook database with rich demo data...")

    # 1. Seed Users
    admin_user = User(
        email="admin@cinebook.com",
        hashed_password=get_password_hash("Admin@123"),
        full_name="CineBook Admin",
        phone="+91 9876543210",
        is_admin=True
    )
    demo_user = User(
        email="user@cinebook.com",
        hashed_password=get_password_hash("User@123"),
        full_name="Rahul Sharma",
        phone="+91 9811223344",
        is_admin=False
    )
    db.add_all([admin_user, demo_user])
    db.commit()

    # 2. Seed Coupons
    coupons = [
        Coupon(code="FIRST10", discount_percent=10.0, description="10% off for first booking", min_amount=200.0),
        Coupon(code="CINE20", discount_percent=20.0, description="20% super cinema discount", min_amount=400.0),
        Coupon(code="STUDENT15", discount_percent=15.0, description="15% student special discount", min_amount=250.0),
    ]
    db.add_all(coupons)
    db.commit()

    # 3. Seed Theatres (5 iconic Indian multiplexes)
    theatres_data = [
        {
            "name": "PVR Director's Cut, Palladium",
            "city": "Mumbai",
            "address": "High Street Phoenix, Senapati Bapat Marg, Lower Parel",
            "formats": "2D,3D,IMAX"
        },
        {
            "name": "INOX Megaplex, Inorbit Mall",
            "city": "Mumbai",
            "address": "Link Road, Malad West, Mumbai",
            "formats": "2D,3D,IMAX,4DX"
        },
        {
            "name": "PVR Superplex, Mall of India",
            "city": "Delhi-NCR",
            "address": "Sector 18, Noida, Delhi-NCR",
            "formats": "2D,3D,IMAX"
        },
        {
            "name": "Cinépolis, Forum Mall",
            "city": "Bengaluru",
            "address": "Hosur Road, Koramangala, Bengaluru",
            "formats": "2D,3D,IMAX"
        },
        {
            "name": "Prasads Multiplex, IMAX Road",
            "city": "Hyderabad",
            "address": "NTR Gardens, Khairatabad, Hyderabad",
            "formats": "2D,3D,IMAX"
        }
    ]

    theatres = []
    for td in theatres_data:
        t = Theatre(**td)
        db.add(t)
        theatres.append(t)
    db.commit()

    # 4. Seed Screens & Seats for each theatre
    screens = []
    for t in theatres:
        for s_idx in range(1, 3): # 2 screens per theatre
            screen = Screen(
                theatre_id=t.id,
                screen_number=s_idx,
                name=f"Audi {s_idx} ({'IMAX Laser' if s_idx == 1 else 'Dolby Atmos'})",
                total_seats=60
            )
            db.add(screen)
            db.flush()
            screens.append(screen)

            # Generate realistic seating grid: 6 rows (A to F), 10 seats per row
            # Row A, B: Silver
            # Row C, D: Gold
            # Row E, F: Platinum (VIP / Recliners)
            for row_char in ["A", "B", "C", "D", "E", "F"]:
                tier = "SILVER"
                if row_char in ["C", "D"]:
                    tier = "GOLD"
                elif row_char in ["E", "F"]:
                    tier = "PLATINUM"

                for seat_num in range(1, 11):
                    seat = Seat(
                        screen_id=screen.id,
                        row_label=row_char,
                        seat_number=seat_num,
                        tier=tier
                    )
                    db.add(seat)

    db.commit()

    # 5. Seed 10+ Blockbuster Movies with rich details
    movies_data = [
        {
            "title": "Kalki 2898 AD",
            "description": "Set in a post-apocalyptic world in the year 2898 AD, a modern avatar of Vishnu descends to Earth to protect the world from evil forces in a grand mythological sci-fi spectacle.",
            "poster_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=kQDd1AhGIHk",
            "genre": "Sci-Fi / Action / Mythology",
            "duration_minutes": 181,
            "release_date": "2024-06-27",
            "language": "Hindi / Telugu",
            "rating": 8.7,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": True,
            "cast": "Prabhas, Amitabh Bachchan, Deepika Padukone, Kamal Haasan",
            "director": "Nag Ashwin"
        },
        {
            "title": "Stree 2: Sarkate Ka Aatank",
            "description": "The town of Chanderi is being haunted again, this time by a headless entity named 'Sarkata' abducting modern women. The gang reunites with Stree to save the town.",
            "poster_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=KVnhe343r3E",
            "genre": "Comedy / Horror",
            "duration_minutes": 149,
            "release_date": "2024-08-15",
            "language": "Hindi",
            "rating": 8.4,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": True,
            "cast": "Rajkummar Rao, Shraddha Kapoor, Pankaj Tripathi, Abhishek Banerjee",
            "director": "Amar Kaushik"
        },
        {
            "title": "Fighter",
            "description": "Top IAF aviators come together in the face of imminent danger, to form Air Dragons. Fighter unfolds their camaraderie, brotherhood and battles, external and internal.",
            "poster_url": "https://images.unsplash.com/photo-1519074069444-1ba4ea16e60b?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=6amIq_mP4xM",
            "genre": "Action / Thriller / Drama",
            "duration_minutes": 166,
            "release_date": "2024-01-25",
            "language": "Hindi",
            "rating": 8.1,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": False,
            "cast": "Hrithik Roshan, Deepika Padukone, Anil Kapoor",
            "director": "Siddharth Anand"
        },
        {
            "title": "Dune: Part Two",
            "description": "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. A monumental sci-fi triumph.",
            "poster_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=Way9Dexny3w",
            "genre": "Sci-Fi / Adventure",
            "duration_minutes": 166,
            "release_date": "2024-03-01",
            "language": "English / Hindi",
            "rating": 8.9,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": True,
            "cast": "Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem",
            "director": "Denis Villeneuve"
        },
        {
            "title": "Interstellar: 10th Anniversary IMAX",
            "description": "When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft along with a team of researchers to find a new planet for humans.",
            "poster_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=zSWdZVtXT7E",
            "genre": "Sci-Fi / Adventure / Drama",
            "duration_minutes": 169,
            "release_date": "2024-11-01",
            "language": "English",
            "rating": 9.1,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": True,
            "cast": "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
            "director": "Christopher Nolan"
        },
        {
            "title": "Devara: Part 1",
            "description": "An epic action saga set against coastal lands, chronicling fear, valour, and emotional conflicts across generations in treacherous seas.",
            "poster_url": "https://images.unsplash.com/photo-1533613220915-609f661a6fe1?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=4sE_W8pB910",
            "genre": "Action / Drama / Thriller",
            "duration_minutes": 178,
            "release_date": "2024-09-27",
            "language": "Telugu / Hindi",
            "rating": 7.9,
            "certificate": "A",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": False,
            "cast": "NTR Jr., Janhvi Kapoor, Saif Ali Khan",
            "director": "Koratala Siva"
        },
        {
            "title": "Pushpa 2: The Rule",
            "description": "Pushpa Raj continues his meteoric rise in the red sanders smuggling syndicate, facing ruthless adversaries and intense police scrutiny.",
            "poster_url": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=g3JUbgFBWu0",
            "genre": "Action / Crime / Thriller",
            "duration_minutes": 185,
            "release_date": "2024-12-05",
            "language": "Telugu / Hindi / Tamil",
            "rating": 8.8,
            "certificate": "UA",
            "is_now_showing": False,
            "is_upcoming": True,
            "is_popular": True,
            "cast": "Allu Arjun, Rashmika Mandanna, Fahadh Faasil",
            "director": "Sukumar"
        },
        {
            "title": "Gladiator II",
            "description": "Years after witnessing the death of Maximus at the hands of his uncle, Lucius must enter the Colosseum after his home is conquered by tyrannical emperors.",
            "poster_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=4rgYUipGJNo",
            "genre": "Action / Historical / Drama",
            "duration_minutes": 148,
            "release_date": "2024-11-15",
            "language": "English / Hindi",
            "rating": 8.3,
            "certificate": "A",
            "is_now_showing": False,
            "is_upcoming": True,
            "is_popular": True,
            "cast": "Paul Mescal, Pedro Pascal, Denzel Washington",
            "director": "Ridley Scott"
        },
        {
            "title": "Avatar: Fire and Ash",
            "description": "Jake Sully and Neytiri encounter the aggressive Ash People tribe of Na'vi, testing their survival and moral boundaries on Pandora.",
            "poster_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=d9MyW72ELq0",
            "genre": "Sci-Fi / Adventure / Fantasy",
            "duration_minutes": 190,
            "release_date": "2025-12-19",
            "language": "English / Hindi",
            "rating": 8.9,
            "certificate": "UA",
            "is_now_showing": False,
            "is_upcoming": True,
            "is_popular": True,
            "cast": "Sam Worthington, Zoe Saldana, Sigourney Weaver",
            "director": "James Cameron"
        },
        {
            "title": "Jawan",
            "description": "A high-octane action thriller outlining the emotional journey of a man set out to rectify the wrongs in the society with a squad of fierce women.",
            "poster_url": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80",
            "backdrop_url": "https://images.unsplash.com/photo-1533613220915-609f661a6fe1?auto=format&fit=crop&w=1200&q=80",
            "trailer_url": "https://www.youtube.com/watch?v=COv52Qyctws",
            "genre": "Action / Thriller",
            "duration_minutes": 169,
            "release_date": "2023-09-07",
            "language": "Hindi / Tamil",
            "rating": 8.2,
            "certificate": "UA",
            "is_now_showing": True,
            "is_upcoming": False,
            "is_popular": True,
            "cast": "Shah Rukh Khan, Nayanthara, Vijay Sethupathi, Deepika Padukone",
            "director": "Atlee"
        }
    ]

    movies = []
    for md in movies_data:
        m = Movie(**md)
        db.add(m)
        movies.append(m)
    db.commit()

    # 6. Seed Shows for Now Showing Movies across Theatres for Today and Next 3 Days
    base_date = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    showtimes_offsets = [
        (10, 0),  # 10:00 AM Morning Show
        (13, 30), # 01:30 PM Matinee Show
        (16, 45), # 04:45 PM Evening Show
        (20, 15), # 08:15 PM Prime Night Show
        (23, 0)   # 11:00 PM Late Night Show
    ]

    now_showing_movies = [m for m in movies if m.is_now_showing]
    shows_added = 0

    for day_offset in range(4): # Today, Tomorrow, Day+2, Day+3
        current_day = base_date + timedelta(days=day_offset)

        for theatre in theatres:
            theatre_screens = [s for s in screens if s.theatre_id == theatre.id]
            for screen in theatre_screens:
                # Alternate movies across screens
                for idx, (hour, minute) in enumerate(showtimes_offsets):
                    movie = now_showing_movies[(theatre.id + screen.id + idx + day_offset) % len(now_showing_movies)]
                    show_dt = current_day.replace(hour=hour, minute=minute)

                    # Determine format & pricing
                    fmt = "IMAX 3D" if "IMAX" in screen.name else ("3D" if idx % 2 == 1 else "2D")
                    silver = 200.0 if "IMAX" in fmt else 160.0
                    gold = 320.0 if "IMAX" in fmt else 250.0
                    platinum = 480.0 if "IMAX" in fmt else 380.0

                    show = Show(
                        movie_id=movie.id,
                        theatre_id=theatre.id,
                        screen_id=screen.id,
                        show_time=show_dt,
                        screen_format=fmt,
                        silver_price=silver,
                        gold_price=gold,
                        platinum_price=platinum
                    )
                    db.add(show)
                    shows_added += 1

    db.commit()
    print(f"Seeding completed successfully! Created {len(movies)} movies, {len(theatres)} theatres, {len(screens)} screens, and {shows_added} shows.")

