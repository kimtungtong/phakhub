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

// 5. API สำหรับดึงข้อมูลคะแนนสะสมจริงของสมาชิกผ่านเบอร์โทรศัพท์ (ล็อคแต้มไม่ให้หายเมื่อสลับหน้าจอ)
app.get('/api/member/:phone', async (req, res) => {
  const { phone } = req.params
  const { data, error } = await supabase
    .from('orders')
    .select('earned_points')
    .eq('phone', phone)
    .eq('user_tier', 'vip')

  if (error) return res.status(500).json({ error: error.message })
  
  // รวมคะแนนสะสมทั้งหมดจากออเดอร์ที่ผ่านมาของเบอร์นี้แบบเรียลไทม์
  const totalPoints = data ? data.reduce((sum, item) => sum + (item.earned_points || 0), 0) : 0
  res.json({ points: totalPoints })
})

// 6. API เจาะลึกสำหรับระบบสมาชิก ดึงทะเบียนและข้อมูลพฤติกรรมการซื้อสะสมแต้มคลาวด์
app.get('/api/admin/members', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('phone, customer_name, user_tier, earned_points')
    .eq('user_tier', 'vip')

  if (error) return res.status(500).json({ error: error.message })
  
  const memberMap = {}
  data.forEach(o => {
    if (!memberMap[o.phone]) {
      memberMap[o.phone] = { phone: o.phone, name: o.customer_name, tier: o.user_tier, points: 0 }
    }
    memberMap[o.phone].points += (o.earned_points || 0)
  })
  res.json(Object.values(memberMap))
})

// 7. API แดชบอร์ดวิเคราะห์สถิติตัวเลขรายรับรวมและการจัดอันดับผักขายดี (Advanced ERP Business Intelligence)
app.get('/api/admin/analytics', async (req, res) => {
  const { data: orders, error } = await supabase.from('orders').select('*')
  if (error) return res.status(500).json({ error: error.message })

  const now = new Date()
  let salesDay = 0, salesMonth = 0, salesYear = 0
  const veggieCount = { week: {}, month: {}, year: {} }

  orders.forEach(order => {
    const oDate = new Date(order.created_at)
    const price = Number(order.total_price || 0)
    const diffTime = Math.abs(now.getTime() - oDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // ประมวลผลกลุ่มแยกรายได้ประจำวัน รายเดือน และรายปี 2026
    if (oDate.toDateString() === now.toDateString()) salesDay += price
    if (oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear()) salesMonth += price
    if (oDate.getFullYear() === now.getFullYear()) salesYear += price

    // แยกข้อมูลตะกร้า JSON เพื่อนับจำนวนความนิยมของผักแต่ละรายการแบบขั้นบันไดเวลา
    const items = order.items || {}
    Object.keys(items).forEach(pId => {
      const qty = Number(items[pId] || 0)
      if (diffDays <= 7) veggieCount.week[pId] = (veggieCount.week[pId] || 0) + qty
      if (diffDays <= 30) veggieCount.month[pId] = (veggieCount.month[pId] || 0) + qty
      if (diffDays <= 365) veggieCount.year[pId] = (veggieCount.year[pId] || 0) + qty
    })
  })

  res.json({ salesDay, salesMonth, salesYear, veggieCount })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 เซิร์ฟเวอร์แอป ผักค้าบ รันแล้วที่ http://localhost:${PORT}`))
