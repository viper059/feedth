-- ระบบจัดการร้าน/รับชำระ (ใช้งานแล้วบนโปรเจกต์: migration admin_payments + repeat_checkins)
-- ตาราง admins, ฟังก์ชัน is_admin, payment_config, create_manual_order, notify_paid, my_orders,
-- admin_orders/confirm/reject/refund/packages/save_package/set_setting/stats

-- *** ขั้นตอนที่เจ้าของต้องทำ 1 ครั้ง: ตั้งตัวเองเป็นแอดมิน (สมัครบัญชีในแอปก่อน แล้วรันใน SQL Editor) ***
-- insert into public.admins (user_id) select id from auth.users where email = 'อีเมลที่ใช้สมัครในแอป';
