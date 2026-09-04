-- Achado navegando o app: a tela deixa anexar carteira de vacinação, mas o
-- "accept" do <input type="file"> é só um filtro de picker do navegador —
-- fácil de contornar (arrastar e soltar, ou trocar a extensão). O bucket
-- em si nunca teve restrição nenhuma de tipo. Isso aqui é aplicado pelo
-- próprio Supabase Storage no upload, não dá pra burlar pelo client.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
where id = 'pet-documents';
