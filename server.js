require('dotenv').config()
const express = require('express')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// เชื่อมต่อฐานข้อมูล Supabase ของแอปผักค้าบ
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// 1. API สำหรับดึงข้อมูลผักสดไปแสดงที่หน้าแอปลูกค้า
app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// 2. API สำหรับรับออเดอร์ผักจากกลุ่มบ้านลูกค้าในหนองบัวลำภู
app.post('/api/orders', async (req, res) => {
  const { customer_name, phone, delivery_address, sub_district, items, total_price, user_tier, discount_amount, earned_points } = req.body
  
  const { data, error } = await supabase.from('orders').insert([{
    customer_name,
    phone,
    delivery_address,
    sub_district,
    items,
    total_price,
    user_tier,
    discount_amount,
    earned_points
  }])

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, message: 'ส่งออเดอร์เข้าฟาร์มเรียบร้อยแล้วครับ' })
})

// 3. API สำหรับหน้าแอดมิน (คนขับรถ) ใช้ดึงรายการสั่งซื้อทั้งหมดมาส่งของ
app.get('/api/admin/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false }) // เอาออเดอร์ใหม่ล่าสุดขึ้นก่อน
    
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// 4. API สำหรับหน้าแอดมิน ใช้กดเปลี่ยนสถานะออเดอร์จากบนรถ (เช่น จาก pending เป็น delivered)
app.put('/api/admin/orders/:id', async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  const { data, error } = await supabase
    .from('orders')
    .update({ status: status })
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, message: 'อัปเดตสถานะออเดอร์เรียบร้อยแล้ว' })
})

// 5. API สำหรับดึงข้อมูลคะแนนสะสมจริงของสมาชิกผ่านเบอร์โทรศัพท์ (ล็อคแต้มไม่ให้หาย)
app.get('/api/member/:phone', async (req, res) => {
  const { phone } = req.params
  const { data, error } = await supabase
    .from('orders')
    .select('earned_points')
    .eq('phone', phone)
    .eq('user_tier', 'vip')

  if (error) return res.status(500).json({ error: error.message })
  
  // รวมคะแนนสะสมทั้งหมดจากออเดอร์ที่ผ่านมาของเบอร์นี้
  const totalPoints = data ? data.reduce((sum, item) => sum + (item.earned_points || 0), 0) : 0
  res.json({ points: totalPoints })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 เซิร์ฟเวอร์แอป ผักค้าบ รันแล้วที่ http://localhost:${PORT}`))
