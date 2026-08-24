// Demo dataset for the no-login branch. Mirrors the seed data in
// supabase/migrations, but lives entirely in the browser — this branch never
// opens a connection to Supabase, so the live database keeps anon locked out.
const H = 3600e3, D = 24 * H;
const at = (days, hours = 0) => new Date(Date.now() + days * D + hours * H).toISOString();

export const CUSTOMERS = [
  { id: "c1", first_name: "Maya",   last_name: "Cohen",   email: "maya.cohen@example.com",   phone: "+972-50-1234567", frequent_flyer_number: "FF100234", tier: "platinum", country: "IL", created_at: at(-420) },
  { id: "c2", first_name: "Daniel", last_name: "Levi",    email: "daniel.levi@example.com",  phone: "+972-52-7654321", frequent_flyer_number: "FF100987", tier: "gold",     country: "IL", created_at: at(-380) },
  { id: "c3", first_name: "Sofia",  last_name: "Rossi",   email: "sofia.rossi@example.com",  phone: "+39-333-9988776", frequent_flyer_number: "FF201455", tier: "silver",   country: "IT", created_at: at(-260) },
  { id: "c4", first_name: "Liam",   last_name: "O'Brien", email: "liam.obrien@example.com",  phone: "+353-86-4433221", frequent_flyer_number: "FF302911", tier: "basic",    country: "IE", created_at: at(-150) },
  { id: "c5", first_name: "Anna",   last_name: "Schmidt", email: "anna.schmidt@example.com", phone: "+49-171-5566778", frequent_flyer_number: "FF403122", tier: "gold",     country: "DE", created_at: at(-95)  },
  { id: "c6", first_name: "Noah",   last_name: "Katz",    email: "noah.katz@example.com",    phone: "+1-415-2233445",  frequent_flyer_number: null,       tier: "basic",    country: "US", created_at: at(-30)  },
];

export const FLIGHTS = [
  { id: "f1", flight_number: "LY315", origin: "TLV", destination: "FRA", departure_time: at(2),   arrival_time: at(2, 4),   aircraft_type: "Boeing 787-9",     capacity: 282, seats_available: 41,  base_price: "420.00", status: "scheduled" },
  { id: "f2", flight_number: "LY316", origin: "FRA", destination: "TLV", departure_time: at(3),   arrival_time: at(3, 4),   aircraft_type: "Boeing 787-9",     capacity: 282, seats_available: 118, base_price: "435.00", status: "scheduled" },
  { id: "f3", flight_number: "LY001", origin: "TLV", destination: "JFK", departure_time: at(5),   arrival_time: at(5, 12),  aircraft_type: "Boeing 777-300ER", capacity: 320, seats_available: 12,  base_price: "980.00", status: "scheduled" },
  { id: "f4", flight_number: "LY028", origin: "TLV", destination: "LHR", departure_time: at(1),   arrival_time: at(1, 5),   aircraft_type: "Airbus A320neo",   capacity: 180, seats_available: 0,   base_price: "310.00", status: "boarding"  },
  { id: "f5", flight_number: "LY382", origin: "TLV", destination: "CDG", departure_time: at(8),   arrival_time: at(8, 5),   aircraft_type: "Airbus A321neo",   capacity: 220, seats_available: 205, base_price: "295.00", status: "scheduled" },
  { id: "f6", flight_number: "LY394", origin: "TLV", destination: "MXP", departure_time: at(-1),  arrival_time: at(-1, 4),  aircraft_type: "Airbus A320neo",   capacity: 180, seats_available: 0,   base_price: "260.00", status: "landed"    },
  { id: "f7", flight_number: "LY086", origin: "TLV", destination: "BKK", departure_time: at(12),  arrival_time: at(12, 11), aircraft_type: "Boeing 787-8",     capacity: 250, seats_available: 88,  base_price: "760.00", status: "delayed"   },
];

export const ORDERS = [
  { id: "o1", booking_ref: "QK4T7A", customer_id: "c1", flight_id: "f1", cabin: "business",        seat_number: "2A",  passenger_count: 1, total_amount: "1480.00", currency: "USD", status: "confirmed",  booked_at: at(-12) },
  { id: "o2", booking_ref: "BX9P2M", customer_id: "c2", flight_id: "f3", cabin: "economy",         seat_number: "34C", passenger_count: 2, total_amount: "1960.00", currency: "USD", status: "confirmed",  booked_at: at(-10) },
  { id: "o3", booking_ref: "ZR5D8N", customer_id: "c3", flight_id: "f4", cabin: "premium_economy", seat_number: "11F", passenger_count: 1, total_amount: "590.00",  currency: "USD", status: "checked_in", booked_at: at(-8)  },
  { id: "o4", booking_ref: "HT3W6Q", customer_id: "c4", flight_id: "f5", cabin: "economy",         seat_number: "22B", passenger_count: 3, total_amount: "885.00",  currency: "USD", status: "pending",    booked_at: at(-6)  },
  { id: "o5", booking_ref: "MN7K1V", customer_id: "c5", flight_id: "f2", cabin: "business",        seat_number: "1C",  passenger_count: 1, total_amount: "1420.00", currency: "USD", status: "confirmed",  booked_at: at(-4)  },
  { id: "o6", booking_ref: "PL2J9X", customer_id: "c6", flight_id: "f6", cabin: "economy",         seat_number: "18A", passenger_count: 1, total_amount: "260.00",  currency: "USD", status: "cancelled",  booked_at: at(-3)  },
  { id: "o7", booking_ref: "YD6R4B", customer_id: "c1", flight_id: "f7", cabin: "first",           seat_number: "1A",  passenger_count: 2, total_amount: "3040.00", currency: "USD", status: "confirmed",  booked_at: at(-1)  },
];
