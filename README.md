# CineBook – Smart Movie Ticket Booking Platform

[![React](https://img.shields.io/badge/Frontend-React_18_TypeScript_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_Python_3.13-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/Database-SQLAlchemy_2.0-D71F00?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![JWT](https://img.shields.io/badge/Auth-JWT_pwdlib-000000?logo=json-web-tokens&logoColor=white)](https://jwt.io/)
[![ReportLab](https://img.shields.io/badge/PDF_Tickets-ReportLab-orange)](https://www.reportlab.com/)

A modern, responsive, and full-featured cinema ticketing web application designed for a 12-hour college hackathon. **CineBook** combines a dark cinematic UI inspired by IMAX and luxury cinema halls with high-reliability backend micro-flows: **5-minute dynamic seat locking**, **rule-based smart seat recommendations**, **simulated multi-method payment checkout**, **dynamic QR entry pass generation**, and **downloadable PDF movie tickets**.

---

## 📽️ Key Features & Capabilities

### 1. Cinematic UI / UX Design
- **Dark Luxury Aesthetic:** Charcoal (`#090a0f`) backgrounds with energetic amber/orange (`#f97316`) neon accents.
- **Hero Blockbuster Showcase:** Large movie backdrops, trailer video modals, ratings, certifications, and instant booking shortcuts.
- **Dynamic City & Format Filtering:** Filter by city (Mumbai, Delhi-NCR, Bengaluru, Hyderabad, Chennai, Pune) and format (2D, 3D, IMAX).
- **Genre & Search Filters:** Instant client/server search and genre categorization (Action, Sci-Fi, Comedy, Thriller, Horror, Drama).

### 2. Smart Seating & Smart Seat Advisor (Recommendation Engine)
- **Interactive Cinema Grid:** Curved cinema screen indicator, aisles, and distinct tiered rows (**Silver Classic**, **Gold Prime**, and **Platinum VIP Recliner**).
- **Consistent Visual Indicators:** Available (Neutral), Booked (Red), Recommended (Green), Selected (Orange), Temporarily Locked (Grey dashed).
- **Temporary Seat Locking (5-minute TTL):** When a customer selects seats and proceeds to checkout, backend locks seats for 300 seconds. Other users cannot double-book them. Automatic expiration cleanup releases seats if checkout is abandoned.
- **Smart Seat Advisor Panel:** Premium recommendation control panel allowing users to specify:
  - Tickets required (1 to 10)
  - Preferred category (Silver, Gold, Platinum, or Any)
  - Maximum budget per ticket
  - Seating preference (Best overall view, Centre seats, Front seats, Back seats, Adjacent seats)
  - Strictly adjacent seating requirement toggle
- **Weighted Rule-Based Optimization Algorithm:**
  $$\text{Final Score} = (0.35 \times \text{Central}) + (0.25 \times \text{Viewing Distance}) + (0.25 \times \text{Adjacent}) + (0.15 \times \text{Budget})$$
  Normalized $0$ to $100$, ranking the top 3 best combinations with detailed score breakdown pills and human-readable explanations.
- **Instant Map Synchronization:** Recommended options glow in green on the interactive cinema grid. 1-click apply updates selection and flows into booking & payment.

### 3. Smart Indoor Seat Navigation
- **Interactive Theatre Blueprint:** Realistic top-view cinema auditorium SVG map generated dynamically from database screen and seat records. Includes curved glowing screen, rows, aisles, accessible seating, entrance, and emergency exit.
- **Visual State System:**
  - **Blue Sonar Marker:** Customer's real-time position.
  - **Green Glow:** Target row highlighted when approached or entered.
  - **Orange Beacon:** Customer's booked seat with pulsating target ring.
  - **Suggested Pathway:** A* pathfinding polyline guiding the customer step-by-step from entrance to seat.
- **Smart Row & Proximity Detection (State Machine):**
  1. `ENTERING_AUDITORIUM` (At entrance)
  2. `MOVING_TO_ROW` (Central/side aisles)
  3. `APPROACHING_ROW` (Row turns glowing **Green**)
  4. `ENTERED_TARGET_ROW` (Alert: *"You are in Row F. Find Seat 10."*)
  5. `APPROACHING_SEAT` (Within ~2.5m)
  6. `SEAT_REACHED` (Success celebration: *"You have reached your seat – F10. Enjoy your movie!"*)
- **Positioning Abstraction & Simulation Mode:**
  - `SimulationLocationProvider`: Interactive 4-way D-Pad (Up/Down/Left/Right) with collision detection (cannot walk over seats) and quick checkpoint jumps.
  - `BLELocationProvider`: Clean architecture stub ready for native mobile iBeacon/Eddystone RSSI trilateration.
- **Multimodal Alerts:** In-app toast banners, status cards, Web Notification API, and mobile Vibration API (`navigator.vibrate`) on milestone arrival.

### 4. Admin Theatre Layout Manager & Physical Classroom Demos
- **Classroom to Cinema Blueprint Conversion:** Convert any physical college classroom or seminar room into a digital cinema auditorium for demonstrating CineBook's Smart Indoor Seat Navigation.
- **Interactive Visual Blueprint Builder:**
  - Dynamic rows (add/remove rows, customizable labels such as A, B, C, D, E).
  - Customizable chairs/seats per row (2 to 14 chairs).
  - Walkable central aisle split (e.g. aisle after chair 3 for split between seats 3 and 4).
  - Left & right side walking corridors and rear concourse.
  - Interactive chair tier cycling (Silver → Gold → Platinum) and accessible seat toggling.
  - Auditorium entrance placement (Rear Center, Rear Left, Rear Right) and emergency exit.
  - Real-time SVG preview canvas with live coordinate calculations.
- **1-Click College Demo Classroom Setup:**
  - Instantly provisions **College Demo Theatre** (`is_demo = True`) with **Screen 1**.
  - 5 rows (A, B, C, D, E), 6 chairs per row (30 seats total).
  - Central aisle between chair 3 and chair 4.
  - Pre-seeded active show so users can book Row C Seat 4 and navigate immediately.
- **Navigation Engine Integration:**
  - Dynamically feeds custom coordinates, rows, and aisle geometry into the A* pathfinding graph (`indoor_navigation_service.py`).
  - Computes obstacle-free walking path from entrance door along the central aisle and turns into Row C for Seat 4.
  - State machine triggers `"You are in Row C. Find Seat 4."` upon entering the row lane and `"You have reached your seat – C4. Enjoy your movie!"` at the chair.
- **Data Protection & Validation:**
  - Rejects duplicate row labels and overlapping chairs.
  - Protects active reservations: unbooked seats can be modified/rearranged, but booked seats cannot be removed.

### 5. Pricing, Coupons & Checkout
- **Itemized Pricing Breakdown:** Real-time subtotal in INR, per-seat convenience fee, and discounts.
- **Verified Promo Codes:**
  - `CINE20`: 20% instant discount (Min order ₹400).
  - `FIRST10`: 10% instant discount (Min order ₹200).
  - `STUDENT15`: 15% student discount (Min order ₹250).

### 4. Custom Simulated Payment System
- **Test Mode Protected:** Clear sandbox indicator—never collects or stores real financial credentials.
- **Payment Methods:** UPI (Google Pay, PhonePe, Paytm, custom VPA), Credit Card, Debit Card, Net Banking (HDFC, ICICI, SBI, Axis), and Digital Wallets.
- **Outcome Simulation:** Switch between **Success**, **Simulated Failure** (e.g. card decline), or **Simulated Cancellation** to demonstrate system resilience and lock release.

### 5. Digital QR Entry Pass & PDF Tickets
- **QR Code Ticket Pass:** Unique cryptographic ticket verification string generated with `qrcode` on confirmation.
- **ReportLab PDF Tickets:** One-click download of branded cinema ticket PDFs containing movie details, theatre hall, showtime, seat labels, payment summary, and gate entry QR code.

### 6. User Portal & Admin Dashboard
- **Customer 'My Bookings':** Manage upcoming, past, and cancelled bookings with full refund simulation.
- **Admin Analytics:**
  - Real-time KPI cards: Total Revenue (₹), Total Bookings, Movies Catalogued, User Count, and Seat Occupancy Rate.
  - Interactive Recharts Visualizations: Revenue by Movie (Bar Chart) & 7-Day Growth Trend (Area Chart).
  - Full CRUD Movie Catalog Management (Add, Edit, Delete).
  - System-wide booking audit logs and payment tracking.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Axios, Lucide React, Recharts |
| **Backend** | Python 3.13, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, PyJWT, pwdlib (Argon2) |
| **Database** | SQLite (Default zero-config local file) / PostgreSQL supported via `DATABASE_URL` |
| **Document & Image Processing** | ReportLab 5.x (PDF Tickets), QRCode 8.x, Pillow 13.x |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher) and `npm`
- **Python** (v3.10 or higher)

---

### Step 1: Backend Setup & Startup

1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   ```

2. (Optional) Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

*The backend will automatically create SQLite database tables (`cinebook.db`) and seed demo movies, theatres, screens, and showtimes upon first launch!*

- **API Base URL:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

---

### Step 2: Frontend Setup & Startup

1. Open a second terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

- **Frontend Web App:** `http://localhost:3000` (or `http://localhost:5173`)

---

### Step 3: Running Tests

Run the full end-to-end integration and feature test suites:

```bash
# 1. Test Theatre Layout Manager & Classroom Demonstration (All 6 Scenarios)
python backend/test_theatre_layout.py

# 2. Test Smart Indoor Seat Navigation (All 10 Scenarios)
python backend/test_indoor_navigation.py

# 3. Test Smart Seat Recommendation System (All 14 Scenarios)
python backend/test_smart_recommendations.py

# 4. Test Full 11-Step Cinema Booking Workflow
python backend/test_e2e_flow.py
```

---

## 🔑 Demo Login Credentials

For quick evaluation during hackathon judging, pre-configured accounts are provided with **1-Click Quick Demo Login** buttons on the `/login` page:

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Administrator** | `admin@cinebook.com` | `Admin@123` | Full Admin Console, Analytics, Movie CRUD |
| **Customer User** | `user@cinebook.com` | `User@123` | Ticket Booking, My Bookings, PDF Downloads |

---

## 📂 Project Structure

```
Movie_ticket_Booking/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entry point & CORS
│   │   ├── config.py                # Environment configs & constants
│   │   ├── database.py              # SQLAlchemy engine & session maker
│   │   ├── seed_data.py             # 10+ Blockbuster movies, 5 theatres, shows & seats
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── user.py              # User authentication & roles
│   │   │   ├── movie.py             # Movie details & metadata
│   │   │   ├── theatre.py           # Theatres & city locations
│   │   │   ├── screen.py            # Auditorium screens & seat capacity
│   │   │   ├── show.py              # Showtimes, screen format & tiered pricing
│   │   │   ├── seat.py              # Seating map (Silver, Gold, Platinum)
│   │   │   ├── booking.py           # Bookings, seats & 5-minute SeatLock
│   │   │   ├── payment.py           # Payment audit records & simulated states
│   │   │   └── coupon.py            # Coupon codes & discount rules
│   │   ├── schemas/                 # Pydantic schemas for request/response validation
│   │   ├── routers/                 # Modular REST API endpoints
│   │   │   ├── auth.py              # Register, login, me
│   │   │   ├── movies.py            # Movie catalogue & admin CRUD
│   │   │   ├── theatres.py          # Multiplex listings & city filters
│   │   │   ├── shows.py             # Shows, seat maps & smart recommendation
│   │   │   ├── bookings.py          # Seat hold/lock, create pending, cancel
│   │   │   ├── payments.py          # Simulated payment processing
│   │   │   ├── tickets.py           # Digital QR and ReportLab PDF downloads
│   │   │   ├── coupons.py           # Promo code validation
│   │   │   └── admin.py             # Analytics dashboard & admin metrics
│   │   ├── services/                # Business logic layer
│   │   │   ├── booking_service.py   # Lock TTL, seat layout & smart recommendation
│   │   │   ├── payment_service.py   # Simulated transaction handling & confirmations
│   │   │   └── ticket_service.py    # ReportLab PDF ticket generator
│   │   └── utils/
│   │       ├── auth.py              # Password hashing (pwdlib) & JWT tokens
│   │       └── qr_generator.py      # QR code PNG generator
│   ├── uploads/
│   │   ├── qrcodes/                 # Generated QR code passes
│   │   └── tickets/                 # Generated PDF tickets
│   ├── test_e2e_flow.py             # 11-step end-to-end automated test suite
│   ├── requirements.txt             # Python dependencies
│   └── .env.example                 # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx           # Cinema branding, city dropdown & search
│   │   │   ├── Footer.tsx           # Cinema links & hackathon footer
│   │   │   ├── MovieCard.tsx        # Poster, rating, tags & booking CTA
│   │   │   ├── SeatGrid.tsx         # Interactive tiered cinema seating map
│   │   │   └── SmartSeatRecommendation.tsx # AI smart group seat selector
│   │   ├── context/
│   │   │   ├── AuthContext.tsx      # User authentication & demo login
│   │   │   └── BookingContext.tsx   # Active booking, 5-min timer & coupon state
│   │   ├── pages/
│   │   │   ├── HomePage.tsx         # Hero banner, Now Showing, Upcoming, Trending
│   │   │   ├── MovieDetailsPage.tsx # Backdrop, synopsis, trailer player & info
│   │   │   ├── ShowtimesPage.tsx    # Date selector, format pills & theatre shows
│   │   │   ├── SeatSelectionPage.tsx # Interactive seat picker & lock countdown
│   │   │   ├── BookingSummaryPage.tsx # Order review & coupon code validator
│   │   │   ├── PaymentPage.tsx      # Simulated checkout with UPI, Card, Net Banking
│   │   │   ├── ConfirmationPage.tsx # QR pass ticket & PDF download trigger
│   │   │   ├── MyBookingsPage.tsx   # Upcoming/past tickets & cancellation refund
│   │   │   ├── LoginPage.tsx        # Login & 1-click hackathon buttons
│   │   │   ├── RegisterPage.tsx     # New customer account registration
│   │   │   └── AdminDashboardPage.tsx # Recharts analytics & movie inventory CRUD
│   │   ├── services/
│   │   │   └── api.ts               # Axios client with JWT interceptor
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces & types
│   │   ├── App.tsx                  # React Router configuration
│   │   ├── main.tsx                 # React DOM mount point
│   │   └── index.css                # Tailwind CSS & custom styles
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.ts               # Vite bundler & API proxy configuration
│   ├── tailwind.config.js           # Cinema dark palette configuration
│   └── tsconfig.json                # TypeScript settings
└── README.md                        # Documentation & setup guide
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new customer account | No |
| `POST` | `/api/auth/login` | Login and receive JWT bearer token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (Bearer) |
| `GET` | `/api/movies` | List movies with genre/search filters | No |
| `GET` | `/api/movies/{id}` | Get detailed movie metadata & trailer | No |
| `POST` | `/api/movies` | Add new movie to catalogue | Admin |
| `PUT` | `/api/movies/{id}` | Update movie information | Admin |
| `DELETE` | `/api/movies/{id}` | Remove movie from catalogue | Admin |
| `GET` | `/api/theatres` | List multiplexes filtered by city | No |
| `GET` | `/api/shows` | List shows by date, theatre, and movie | No |
| `GET` | `/api/shows/{id}/seats` | Real-time seat map with lock statuses | Optional |
| `POST` | `/api/shows/{id}/recommend-seats` | Smart rule-based adjacent seat picker | No |
| `POST` | `/api/bookings/hold-seats` | Temporarily locks selected seats (5m TTL) | Yes |
| `POST` | `/api/bookings/release-seats` | Explicitly releases held seats | Yes |
| `POST` | `/api/bookings/create-pending` | Creates pending order & calculates pricing | Yes |
| `POST` | `/api/payments/process` | Executes simulated checkout & issues pass | Yes |
| `GET` | `/api/tickets/{id}/download` | Generates & downloads ReportLab PDF ticket | No |
| `GET` | `/api/bookings/my-bookings` | Lists user's confirmed/cancelled tickets | Yes |
| `POST` | `/api/bookings/{id}/cancel` | Cancels booking & simulates instant refund | Yes |
| `POST` | `/api/coupons/validate` | Validates promo discount codes | No |
| `GET` | `/api/admin/dashboard` | Returns revenue, occupancy & chart stats | Admin |
| `GET` | `/api/admin/bookings` | View full transaction audit log | Admin |

---

## 🧪 Testing the E2E Lifecycle

A complete automated Python test suite is included at `backend/test_e2e_flow.py` to verify:
1. Health and discovery endpoints
2. User authentication & JWT decoding
3. Movie & showtime queries
4. Smart seat recommendations (Row D center auditorium)
5. 5-minute seat locking & concurrency checks
6. Coupon code application (`CINE20`)
7. Pending booking calculation
8. Simulated payment completion
9. QR code generation
10. Downloadable ReportLab PDF ticket generation
11. User 'My Bookings' and Admin Analytics synchronization

Run the test with:
```bash
cd backend
python test_e2e_flow.py
```

---

## 🏆 Hackathon Notes
- **Simulated Payment:** Safe for demonstrations; no real payment credentials required.
- **Dynamic Lock Expiration:** Try leaving seats selected on one browser tab and watch the 5-minute countdown auto-expire and release them!
- **Zero-Config Database:** Starts immediately with seeded blockbuster movies, Indian theatres, screens, and shows.

