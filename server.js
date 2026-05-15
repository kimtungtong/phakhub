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
  const { customer_name, phone, delivery_address, sub_district, items, total_price } = req.body
  
  const { data, error } = await supabase.from('orders').insert([{
    customer_name,
    phone,
    delivery_address,
    sub_district,
    items,
    total_price
  }])

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, message: 'ส่งออเดอร์เข้าฟาร์มเรียบร้อยแล้วครับ' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 เซิร์ฟเวอร์แอป ผักค้าบ รันแล้วที่ http://localhost:${PORT}`))
