-- Datos de DEMO para desarrollo local (marcas y productos genéricos, no son reales).
-- Los productos reales los carga Camila desde el panel /admin.

insert into public.brands (slug, name) values
  ('marca-demo-a', 'Marca Demo A'),
  ('marca-demo-b', 'Marca Demo B');

insert into public.categories (slug, name) values
  ('limpieza', 'Limpieza'),
  ('tratamiento', 'Tratamiento'),
  ('hidratacion', 'Hidratación'),
  ('proteccion-solar', 'Protección solar');

insert into public.product_lines (brand_id, slug, name, description)
select id, 'linea-calmante', 'Línea Calmante',
  'Una rutina simple de tres pasos con ingredientes esenciales para un cuidado suave, pensada para la mayoría de los tipos de piel.'
from public.brands where slug = 'marca-demo-a';

insert into public.products (
  slug, name, brand_id, category_id, line_id, routine_step, summary, price_ars, volume,
  key_ingredients, benefits, usage_steps, skin_types, warnings, stock, status
)
select
  p.slug, p.name, b.id, c.id, l.id, p.routine_step, p.summary, p.price_ars, p.volume,
  p.key_ingredients, p.benefits, p.usage_steps, p.skin_types, p.warnings, p.stock, 'published'
from (values
  (
    'aceite-limpiador-ligero', 'Aceite limpiador ligero', 'marca-demo-a', 'limpieza', 'linea-calmante', 1::smallint,
    'Primer paso de la rutina: remueve maquillaje y protector solar con una textura liviana que se enjuaga fácil.',
    18500, '200 ml',
    'Extracto de centella asiática, aceites de origen vegetal.',
    array['Ayuda a remover maquillaje y protector solar', 'Textura liviana, se enjuaga con facilidad', 'No deja sensación grasa en la piel'],
    array['Aplicá una cantidad adecuada sobre el rostro seco.', 'Masajeá suavemente y sumá agua tibia hasta que se vuelva lechoso.', 'Enjuagá con abundante agua.'],
    array['Todo tipo de piel'],
    'Evitar el contacto con los ojos. Suspender el uso ante signos de irritación.',
    12
  ),
  (
    'espuma-limpiadora-suave', 'Espuma limpiadora suave', 'marca-demo-b', 'limpieza', null, null,
    'Limpiador en espuma de pH balanceado para completar la limpieza sin resecar.',
    14900, '125 ml',
    'Extracto de centella asiática, derivados de coco.',
    array['Limpia sin dejar sensación de tirantez', 'pH balanceado', 'Espuma cremosa y delicada'],
    array['Frotá una cantidad adecuada en las manos húmedas hasta formar espuma.', 'Masajeá el rostro con movimientos suaves.', 'Enjuagá bien con agua tibia.'],
    array['Mixta', 'Grasa', 'Sensible'],
    'Evitar el contacto con los ojos.',
    8
  ),
  (
    'ampolla-calmante', 'Ampolla calmante', 'marca-demo-a', 'tratamiento', 'linea-calmante', 2::smallint,
    'Concentrado de textura acuosa que hidrata y deja la piel sensible con sensación de calma.',
    24900, '55 ml',
    'Extracto de centella asiática.',
    array['Aporta hidratación inmediata', 'Textura acuosa y no pegajosa', 'Pensada para pieles sensibles'],
    array['Después de limpiar el rostro, aplicá unas gotas con el gotero.', 'Extendé con suaves toques hasta que se absorba.'],
    array['Sensible', 'Seca', 'Mixta'],
    'Hacer una prueba en la muñeca antes del primer uso.',
    5
  ),
  (
    'crema-calmante-ceramidas', 'Crema calmante con ceramidas', 'marca-demo-a', 'hidratacion', 'linea-calmante', 2::smallint,
    'Crema de textura gel con ceramidas que ayuda a mantener la barrera de la piel hidratada.',
    21500, '75 ml',
    'Ceramidas, colesterol, ácidos grasos, extracto de centella asiática.',
    array['Ayuda a reforzar la barrera cutánea', 'Hidratación liviana, sin sensación pegajosa', 'Sensación de confort durante el día'],
    array['Aplicá sobre el rostro limpio y de suaves toquecitos con las palmas.', 'Usala por la mañana y por la noche.'],
    array['Seca', 'Sensible'],
    'Evitar el contacto con los ojos.',
    0
  ),
  (
    'protector-solar-fps-50', 'Protector solar FPS 50', 'marca-demo-a', 'proteccion-solar', 'linea-calmante', 3::smallint,
    'Último paso de la rutina de día: protección solar de amplio espectro con acabado mate.',
    19900, '50 ml',
    'Filtros UV minerales, niacinamida.',
    array['Protección UVA y UVB de amplio espectro', 'Acabado mate', 'Deja poco residuo blanco'],
    array['Como último paso de la rutina, aplicá de forma pareja en las zonas expuestas.', 'Volvé a aplicar cada 2 horas si te exponés al sol.'],
    array['Todo tipo de piel'],
    'Uso externo. No reemplaza otras medidas de protección solar.',
    20
  )
) as p (slug, name, brand_slug, category_slug, line_slug, routine_step, summary, price_ars, volume,
        key_ingredients, benefits, usage_steps, skin_types, warnings, stock)
join public.brands b on b.slug = p.brand_slug
join public.categories c on c.slug = p.category_slug
left join public.product_lines l on l.slug = p.line_slug and l.brand_id = b.id;
