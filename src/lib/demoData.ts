// Demo Business Dataset: Radhe Embroidery (રાધે એમ્બ્રોઇડરી - Surat)
// Allows instant interactive exploration without live Supabase credentials.

export interface DemoVepari {
  id: string
  name: string
  phone: string
  market_name: string
  gst_number: string
  opening_balance: number
  total_billed: number
  total_received: number
  balance: number
}

export interface DemoFactory {
  id: string
  name: string
  phone: string
  location: string
  is_own: boolean
  machine_count: number
  total_allotted_amount: number
  total_paid: number
  balance: number
}

export interface DemoLotItem {
  id: string
  lot_id: string
  work_type_name: string // Top, Sleeve, Daman, Kali, Lace, Plazo, etc.
  pieces: number
  allotted_pieces: number
  rate: number
  amount: number
}

export interface DemoLot {
  id: string
  lot_number: string
  challan_number: string
  vepari_id: string
  vepari_name: string
  date: string
  due_date: string
  design_number: string
  description: string
  total_pieces: number
  allotted_pieces: number
  pricing_type: 'per_piece' | 'full_lot'
  total_amount: number
  factory_allotment_amount: number
  commission_margin: number
  status: 'received' | 'in_progress' | 'completed' | 'delivered'
  is_overdue: boolean
  assigned_factory_name?: string
  items: DemoLotItem[]
}

export interface DemoWorker {
  id: string
  name: string
  phone: string
  role: string
  wage_type: 'monthly' | 'piece_rate'
  base_wage: number
  shifts_worked: number
  gross_earned: number
  upaad_paid: number
  net_payable: number
}

export interface DemoWorkerAdvance {
  id: string
  worker_id: string
  worker_name: string
  amount: number
  date: string
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer'
  notes: string
}

export interface DemoMaterialShop {
  id: string
  name: string
  owner_name: string
  phone: string
  items_supplied: string
  opening_balance: number
  total_purchases: number
  total_paid: number
  current_balance: number
}

export interface DemoMaterialPurchase {
  id: string
  shop_id: string
  shop_name: string
  bill_number: string
  bill_date: string
  item_name: string
  quantity: string
  rate: number
  total_amount: number
  payment_status: 'unpaid' | 'partial' | 'paid'
}

export const DEMO_BUSINESS = {
  id: 'demo-biz-radhe-01',
  name: 'Radhe Embroidery (રાધે એમ્બ્રોઇડરી)',
  owner_name: 'Ghanshyambhai Patel',
  phone: '+91 98251 44210',
  address: 'Plot 42, Khatodara GIDC, Ring Road, Surat, Gujarat 395002',
  gst_number: '24AAACR1234F1Z8',
}

export const DEMO_VEPARIS: DemoVepari[] = [
  {
    id: 'vep-01',
    name: 'Navkar Fashions (નવકાર ફેશન)',
    phone: '9825123450',
    market_name: 'Ring Road New Textile Market',
    gst_number: '24AAACN1029F1Z1',
    opening_balance: 35000,
    total_billed: 165000,
    total_received: 115000,
    balance: 85000,
  },
  {
    id: 'vep-02',
    name: 'Shreeram Prints & Sarees (શ્રીરામ પ્રિન્ટ્સ)',
    phone: '9825234561',
    market_name: 'Millennium Textile Market, Ring Road',
    gst_number: '24AACFS8820A1Z5',
    opening_balance: 50000,
    total_billed: 240000,
    total_received: 170000,
    balance: 120000,
  },
  {
    id: 'vep-03',
    name: 'Radhe Krishna Sarees (રાધે ક્રિષ્ના)',
    phone: '9825345672',
    market_name: 'Surat Textile Tower',
    gst_number: '24AAARK4412B1Z3',
    opening_balance: 15000,
    total_billed: 95000,
    total_received: 65000,
    balance: 45000,
  },
  {
    id: 'vep-04',
    name: 'Jay Ambe Fabrics (જય અંબે ફેબ્રિક્સ)',
    phone: '9825456783',
    market_name: 'Moti Begumwadi, Ring Road',
    gst_number: '24AAAJB7761C1Z9',
    opening_balance: 20000,
    total_billed: 182000,
    total_received: 110000,
    balance: 92000,
  },
  {
    id: 'vep-05',
    name: 'Mahadev Textiles (મહાદેવ ટેક્સટાઇલ)',
    phone: '9825567894',
    market_name: 'Kamela Darwaja, Surat',
    gst_number: '24AAAMT3321D1Z7',
    opening_balance: 10000,
    total_billed: 78000,
    total_received: 50000,
    balance: 38000,
  },
]

export const DEMO_FACTORIES: DemoFactory[] = [
  {
    id: 'fac-01',
    name: 'My Own Unit — Khatodara GIDC (મશીન ૧ & ૨)',
    phone: '9825144210',
    location: 'Plot 42, Khatodara GIDC, Surat',
    is_own: true,
    machine_count: 2,
    total_allotted_amount: 145000,
    total_paid: 145000,
    balance: 0,
  },
  {
    id: 'fac-02',
    name: 'Maruti Embroidery Job Work (મારૂતિ જોબ વર્ક)',
    phone: '9898012345',
    location: 'Katargam GIDC, Surat',
    is_own: false,
    machine_count: 4,
    total_allotted_amount: 198000,
    total_paid: 140000,
    balance: 58000,
  },
  {
    id: 'fac-03',
    name: 'Shiv Shakti Multi Job Work (શિવ શક્તિ)',
    phone: '9898123456',
    location: 'Anjana Farm, Surat',
    is_own: false,
    machine_count: 3,
    total_allotted_amount: 125000,
    total_paid: 85000,
    balance: 40000,
  },
  {
    id: 'fac-04',
    name: 'Krishna Arts Schiffli & Multi (ક્રિષ્ના આર્ટ્સ)',
    phone: '9898234567',
    location: 'Sachin GIDC, Surat',
    is_own: false,
    machine_count: 6,
    total_allotted_amount: 210000,
    total_paid: 165000,
    balance: 45000,
  },
]

export const DEMO_LOTS: DemoLot[] = [
  {
    id: 'lot-8901',
    lot_number: 'L-8901',
    challan_number: 'CH-2401',
    vepari_id: 'vep-01',
    vepari_name: 'Navkar Fashions (નવકાર ફેશન)',
    date: '2026-11-01',
    due_date: '2026-11-04',
    design_number: 'DS-409 (Heavy Cording Kurti)',
    description: 'Cotton Silk fabric with zari & sequence embroidery',
    total_pieces: 480,
    allotted_pieces: 480,
    pricing_type: 'per_piece',
    total_amount: 40800,
    factory_allotment_amount: 31200,
    commission_margin: 9600,
    status: 'in_progress',
    is_overdue: false,
    assigned_factory_name: 'Maruti Embroidery Job Work',
    items: [
      { id: 'li-01', lot_id: 'lot-8901', work_type_name: 'Top (Front)', pieces: 480, allotted_pieces: 480, rate: 50, amount: 24000 },
      { id: 'li-02', lot_id: 'lot-8901', work_type_name: 'Sleeve (2 Pcs)', pieces: 480, allotted_pieces: 480, rate: 20, amount: 9600 },
      { id: 'li-03', lot_id: 'lot-8901', work_type_name: 'Daman Lace', pieces: 480, allotted_pieces: 480, rate: 15, amount: 7200 },
    ],
  },
  {
    id: 'lot-8902',
    lot_number: 'L-8902',
    challan_number: 'CH-2402',
    vepari_id: 'vep-02',
    vepari_name: 'Shreeram Prints & Sarees',
    date: '2026-10-28',
    due_date: '2026-11-01',
    design_number: 'DS-312 (12-Kali Bridal Lehenga)',
    description: 'Organza base with resham multi thread embroidery',
    total_pieces: 1200,
    allotted_pieces: 1200,
    pricing_type: 'per_piece',
    total_amount: 54000,
    factory_allotment_amount: 42000,
    commission_margin: 12000,
    status: 'completed',
    is_overdue: false,
    assigned_factory_name: 'Krishna Arts Schiffli',
    items: [
      { id: 'li-04', lot_id: 'lot-8902', work_type_name: 'Kali (12 Pcs/Set)', pieces: 900, allotted_pieces: 900, rate: 45, amount: 40500 },
      { id: 'li-05', lot_id: 'lot-8902', work_type_name: 'Belt / Lace', pieces: 300, allotted_pieces: 300, rate: 45, amount: 13500 },
    ],
  },
  {
    id: 'lot-8903',
    lot_number: 'L-8903',
    challan_number: 'CH-2403',
    vepari_id: 'vep-03',
    vepari_name: 'Radhe Krishna Sarees',
    date: '2026-11-02',
    due_date: '2026-11-07',
    design_number: 'DS-990 (All-Over Multi Saree)',
    description: 'Vichitra Silk with 5mm tone-to-tone sequins',
    total_pieces: 350,
    allotted_pieces: 0,
    pricing_type: 'per_piece',
    total_amount: 45500,
    factory_allotment_amount: 0,
    commission_margin: 0,
    status: 'received',
    is_overdue: false,
    items: [
      { id: 'li-06', lot_id: 'lot-8903', work_type_name: 'Full Saree (5.5 Mtr)', pieces: 350, allotted_pieces: 0, rate: 130, amount: 45500 },
    ],
  },
  {
    id: 'lot-8904',
    lot_number: 'L-8904',
    challan_number: 'CH-2404',
    vepari_id: 'vep-04',
    vepari_name: 'Jay Ambe Fabrics',
    date: '2026-10-25',
    due_date: '2026-10-31',
    design_number: 'DS-115 (Plazo + Border Set)',
    description: 'Rayon 14kg with silver zari cording',
    total_pieces: 600,
    allotted_pieces: 600,
    pricing_type: 'per_piece',
    total_amount: 39000,
    factory_allotment_amount: 27000,
    commission_margin: 12000,
    status: 'in_progress',
    is_overdue: true, // OVERDUE!
    assigned_factory_name: 'My Own Unit (Khatodara)',
    items: [
      { id: 'li-07', lot_id: 'lot-8904', work_type_name: 'Plazo Bottom', pieces: 400, allotted_pieces: 400, rate: 70, amount: 28000 },
      { id: 'li-08', lot_id: 'lot-8904', work_type_name: 'Dupatta Lace', pieces: 200, allotted_pieces: 200, rate: 55, amount: 11000 },
    ],
  },
  {
    id: 'lot-8905',
    lot_number: 'L-8905',
    challan_number: 'CH-2405',
    vepari_id: 'vep-05',
    vepari_name: 'Mahadev Textiles',
    date: '2026-10-30',
    due_date: '2026-11-05',
    design_number: 'DS-774 (Designer Blouse Front/Back)',
    description: 'Phantom Silk with antique gold dori embroidery',
    total_pieces: 800,
    allotted_pieces: 800,
    pricing_type: 'per_piece',
    total_amount: 44000,
    factory_allotment_amount: 33600,
    commission_margin: 10400,
    status: 'in_progress',
    is_overdue: false,
    assigned_factory_name: 'Shiv Shakti Multi Job Work',
    items: [
      { id: 'li-09', lot_id: 'lot-8905', work_type_name: 'Blouse Front & Neck', pieces: 400, allotted_pieces: 400, rate: 65, amount: 26000 },
      { id: 'li-10', lot_id: 'lot-8905', work_type_name: 'Blouse Back & Sleeves', pieces: 400, allotted_pieces: 400, rate: 45, amount: 18000 },
    ],
  },
  {
    id: 'lot-8906',
    lot_number: 'L-8906',
    challan_number: 'CH-2406',
    vepari_id: 'vep-01',
    vepari_name: 'Navkar Fashions',
    date: '2026-10-22',
    due_date: '2026-10-27',
    design_number: 'DS-204 (Kurti Neck & Daman)',
    description: 'Chanderi silk festive collection',
    total_pieces: 550,
    allotted_pieces: 550,
    pricing_type: 'per_piece',
    total_amount: 41250,
    factory_allotment_amount: 30250,
    commission_margin: 11000,
    status: 'completed',
    is_overdue: false,
    assigned_factory_name: 'Maruti Embroidery Job Work',
    items: [
      { id: 'li-11', lot_id: 'lot-8906', work_type_name: 'Kurti Top', pieces: 550, allotted_pieces: 550, rate: 75, amount: 41250 },
    ],
  },
  {
    id: 'lot-8907',
    lot_number: 'L-8907',
    challan_number: 'CH-2407',
    vepari_id: 'vep-02',
    vepari_name: 'Shreeram Prints & Sarees',
    date: '2026-10-26',
    due_date: '2026-10-31',
    design_number: 'DS-610 (Georgette Gown Border)',
    description: 'Fox Georgette heavy sequence panel work',
    total_pieces: 900,
    allotted_pieces: 900,
    pricing_type: 'per_piece',
    total_amount: 54000,
    factory_allotment_amount: 40500,
    commission_margin: 13500,
    status: 'in_progress',
    is_overdue: true, // OVERDUE!
    assigned_factory_name: 'Krishna Arts Schiffli',
    items: [
      { id: 'li-12', lot_id: 'lot-8907', work_type_name: 'Gown Panel', pieces: 900, allotted_pieces: 900, rate: 60, amount: 54000 },
    ],
  },
  {
    id: 'lot-8908',
    lot_number: 'L-8908',
    challan_number: 'CH-2408',
    vepari_id: 'vep-03',
    vepari_name: 'Radhe Krishna Sarees',
    date: '2026-11-03',
    due_date: '2026-11-09',
    design_number: 'DS-901 (Bridal 16-Kali Set)',
    description: 'Velvet base heavy zari with rainbow sequins',
    total_pieces: 200,
    allotted_pieces: 0,
    pricing_type: 'per_piece',
    total_amount: 56000,
    factory_allotment_amount: 0,
    commission_margin: 0,
    status: 'received',
    is_overdue: false,
    items: [
      { id: 'li-13', lot_id: 'lot-8908', work_type_name: 'Bridal Kali Set', pieces: 200, allotted_pieces: 0, rate: 280, amount: 56000 },
    ],
  },
  {
    id: 'lot-8909',
    lot_number: 'L-8909',
    challan_number: 'CH-2409',
    vepari_id: 'vep-04',
    vepari_name: 'Jay Ambe Fabrics',
    date: '2026-10-20',
    due_date: '2026-10-25',
    design_number: 'DS-082 (Lace Roll Schiffli)',
    description: 'Cotton Schiffli border roll (meters)',
    total_pieces: 2500,
    allotted_pieces: 2500,
    pricing_type: 'per_piece',
    total_amount: 30000,
    factory_allotment_amount: 22500,
    commission_margin: 7500,
    status: 'completed',
    is_overdue: false,
    assigned_factory_name: 'My Own Unit (Khatodara)',
    items: [
      { id: 'li-14', lot_id: 'lot-8909', work_type_name: 'Lace Meter Roll', pieces: 2500, allotted_pieces: 2500, rate: 12, amount: 30000 },
    ],
  },
  {
    id: 'lot-8910',
    lot_number: 'L-8910',
    challan_number: 'CH-2410',
    vepari_id: 'vep-05',
    vepari_name: 'Mahadev Textiles',
    date: '2026-10-29',
    due_date: '2026-11-04',
    design_number: 'DS-552 (Chaniya Choli Set)',
    description: 'Traditional Gujarati Navratri mirror embroidery',
    total_pieces: 400,
    allotted_pieces: 400,
    pricing_type: 'per_piece',
    total_amount: 38000,
    factory_allotment_amount: 28000,
    commission_margin: 10000,
    status: 'in_progress',
    is_overdue: false,
    assigned_factory_name: 'Shiv Shakti Multi Job Work',
    items: [
      { id: 'li-15', lot_id: 'lot-8910', work_type_name: 'Choli Top & Dupatta', pieces: 400, allotted_pieces: 400, rate: 95, amount: 38000 },
    ],
  },
]

export const DEMO_WORKERS: DemoWorker[] = [
  {
    id: 'w-01',
    name: 'Ramesh Kumar (Operator)',
    phone: '9876543210',
    role: 'Machine Operator (મશીન ઓપરેટર)',
    wage_type: 'monthly',
    base_wage: 22000,
    shifts_worked: 32, // includes double shifts
    gross_earned: 23467,
    upaad_paid: 5000,
    net_payable: 18467,
  },
  {
    id: 'w-02',
    name: 'Suresh Bhai Patel (Master)',
    phone: '9825123456',
    role: 'Embroidery Master (ડિઝાઇન / માસ્ટર)',
    wage_type: 'monthly',
    base_wage: 32000,
    shifts_worked: 30,
    gross_earned: 32000,
    upaad_paid: 6500,
    net_payable: 25500,
  },
  {
    id: 'w-03',
    name: 'Mukesh Yadav (Cutter)',
    phone: '9898765432',
    role: 'Thread Cutter / Dora Cutting (દોરા કટીંગ)',
    wage_type: 'monthly',
    base_wage: 14000,
    shifts_worked: 27,
    gross_earned: 12600,
    upaad_paid: 2000,
    net_payable: 10600,
  },
  {
    id: 'w-04',
    name: 'Dinesh Rathod (Piece Work)',
    phone: '9898654321',
    role: 'Piece-Rate Operator (પીસ-રેટ કારીગર)',
    wage_type: 'piece_rate',
    base_wage: 8, // ₹8 per piece
    shifts_worked: 26,
    gross_earned: 14400, // 1800 pcs * ₹8
    upaad_paid: 3000,
    net_payable: 11400,
  },
  {
    id: 'w-05',
    name: 'Pravin Bhai Parmar (Mending)',
    phone: '9876123450',
    role: 'Mending & Framing Master (ફ્રેમિંગ)',
    wage_type: 'monthly',
    base_wage: 16000,
    shifts_worked: 29,
    gross_earned: 15467,
    upaad_paid: 2500,
    net_payable: 12967,
  },
  {
    id: 'w-06',
    name: 'Sunil Solanki (Night Shift)',
    phone: '9825987654',
    role: 'Night Shift Operator (નાઇટ ઓપરેટર)',
    wage_type: 'monthly',
    base_wage: 23000,
    shifts_worked: 36, // includes double shifts
    gross_earned: 27600,
    upaad_paid: 4000,
    net_payable: 23600,
  },
]

export const DEMO_WORKER_ADVANCES: DemoWorkerAdvance[] = [
  {
    id: 'adv-01',
    worker_id: 'w-01',
    worker_name: 'Ramesh Kumar (Operator)',
    amount: 3000,
    date: '2026-11-01',
    payment_mode: 'Cash',
    notes: 'Home rent advance (ભાડું ચૂકવવા)',
  },
  {
    id: 'adv-02',
    worker_id: 'w-01',
    worker_name: 'Ramesh Kumar (Operator)',
    amount: 2000,
    date: '2026-11-02',
    payment_mode: 'UPI',
    notes: 'Grocery expense advance',
  },
  {
    id: 'adv-03',
    worker_id: 'w-02',
    worker_name: 'Suresh Bhai Patel (Master)',
    amount: 6500,
    date: '2026-10-31',
    payment_mode: 'Bank Transfer',
    notes: 'Diwali preparation / family upaad',
  },
  {
    id: 'adv-04',
    worker_id: 'w-03',
    worker_name: 'Mukesh Yadav (Cutter)',
    amount: 2000,
    date: '2026-11-02',
    payment_mode: 'Cash',
    notes: 'Village remittance',
  },
  {
    id: 'adv-05',
    worker_id: 'w-04',
    worker_name: 'Dinesh Rathod (Piece Work)',
    amount: 3000,
    date: '2026-11-01',
    payment_mode: 'UPI',
    notes: 'Emergency medical upaad',
  },
  {
    id: 'adv-06',
    worker_id: 'w-05',
    worker_name: 'Pravin Bhai Parmar (Mending)',
    amount: 2500,
    date: '2026-11-02',
    payment_mode: 'Cash',
    notes: 'Bike petrol & personal expense',
  },
  {
    id: 'adv-07',
    worker_id: 'w-06',
    worker_name: 'Sunil Solanki (Night Shift)',
    amount: 4000,
    date: '2026-11-01',
    payment_mode: 'UPI',
    notes: 'Children school fees advance',
  },
]

export const DEMO_MATERIAL_SHOPS: DemoMaterialShop[] = [
  {
    id: 'shop-01',
    name: 'Surat Zari Trading Co.',
    owner_name: 'Kantilal Zariwala',
    phone: '9825011223',
    items_supplied: 'Metallic Zari Spools (120D/250D, Gold, Silver, Antique)',
    opening_balance: 15000,
    total_purchases: 85000,
    total_paid: 65000,
    current_balance: 35000,
  },
  {
    id: 'shop-02',
    name: 'Super Poly Thread & Bobbin Stores',
    owner_name: 'Dharmesh Bhai',
    phone: '9825022334',
    items_supplied: '100% Polyester Cones (40wt), White/Black Bobbin Thread',
    opening_balance: 8000,
    total_purchases: 62000,
    total_paid: 48000,
    current_balance: 22000,
  },
  {
    id: 'shop-03',
    name: 'Shree Ganesh Fusing & Needles',
    owner_name: 'Pravin Solanki',
    phone: '9825033445',
    items_supplied: 'Non-woven Fusing Paper Rolls (40/50 GSM), Organ Needles DBxK5 #11/#14',
    opening_balance: 5000,
    total_purchases: 45000,
    total_paid: 32000,
    current_balance: 18000,
  },
  {
    id: 'shop-04',
    name: 'Apex Sequins, Dori & Machine Spares',
    owner_name: 'Haresh Bhai Shah',
    phone: '9825044556',
    items_supplied: '3mm/5mm Sequins Rolls, Cording Dori, Cutter Knives, Rotary Hooks',
    opening_balance: 12000,
    total_purchases: 94000,
    total_paid: 78000,
    current_balance: 28000,
  },
]

export const DEMO_MATERIAL_PURCHASES: DemoMaterialPurchase[] = [
  {
    id: 'mp-01',
    shop_id: 'shop-01',
    shop_name: 'Surat Zari Trading Co.',
    bill_number: 'SZ-402',
    bill_date: '2026-11-01',
    item_name: 'Antique Gold Zari Spools (120D)',
    quantity: '50 Boxes (250 Cones)',
    rate: 74,
    total_amount: 18500,
    payment_status: 'unpaid',
  },
  {
    id: 'mp-02',
    shop_id: 'shop-02',
    shop_name: 'Super Poly Thread Stores',
    bill_number: 'ST-889',
    bill_date: '2026-10-29',
    item_name: 'Polyester Embroidery Thread (Assorted Shades)',
    quantity: '80 Cones (5000m)',
    rate: 155,
    total_amount: 12400,
    payment_status: 'unpaid',
  },
  {
    id: 'mp-03',
    shop_id: 'shop-03',
    shop_name: 'Shree Ganesh Fusing & Needles',
    bill_number: 'GF-112',
    bill_date: '2026-10-27',
    item_name: 'Non-woven Water Soluble Fusing Rolls & DBxK5 Needles',
    quantity: '10 Rolls + 20 Pkts',
    rate: 490,
    total_amount: 9800,
    payment_status: 'paid',
  },
  {
    id: 'mp-04',
    shop_id: 'shop-04',
    shop_name: 'Apex Sequins & Spares',
    bill_number: 'AX-991',
    bill_date: '2026-11-02',
    item_name: '3mm Hologram Rainbow Sequins Rolls + 2 Rotary Hooks',
    quantity: '25 Rolls + 2 Pcs',
    rate: 608,
    total_amount: 15200,
    payment_status: 'unpaid',
  },
]

export function getDemoDashboardMetrics() {
  const totalReceivable = DEMO_VEPARIS.reduce((s, v) => s + v.balance, 0)
  const totalPayable = DEMO_FACTORIES.filter((f) => !f.is_own).reduce((s, f) => s + f.balance, 0)
  const runningLotsCount = DEMO_LOTS.filter((l) => l.status === 'in_progress').length
  const overdueLots = DEMO_LOTS.filter((l) => l.is_overdue)
  const overdueAmount = overdueLots.reduce((s, l) => s + l.total_amount, 0)

  return {
    totalReceivable,
    totalPayable,
    runningLotsCount,
    overdueLotsCount: overdueLots.length,
    overdueAmount,
    overdueLots,
    receivedLotsCount: DEMO_LOTS.filter((l) => l.status === 'received').length,
    completedLotsCount: DEMO_LOTS.filter((l) => l.status === 'completed').length,
  }
}
