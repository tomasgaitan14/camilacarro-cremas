-- Datos de DEMO para desarrollo local, armados con la presentación de SKIN1004 (referencias/).
-- Son solo para mostrarle a Camila cómo se ve la tienda con productos reales: precios y stock son inventados.
-- Los productos reales los carga Camila desde el panel /admin.

insert into public.brands (slug, name) values
  ('skin1004', 'SKIN1004');

insert into public.categories (slug, name) values
  ('limpieza', 'Limpieza'),
  ('tonicos', 'Tónicos'),
  ('tratamiento', 'Tratamiento'),
  ('hidratacion', 'Hidratación'),
  ('proteccion-solar', 'Protección solar');

insert into public.product_lines (brand_id, slug, name, description)
select id, 'madagascar-centella', 'Madagascar Centella',
  'Productos con solo los ingredientes esenciales para un cuidado suave de la piel, pensados para la mayoría de los tipos de piel.'
from public.brands where slug = 'skin1004';

insert into public.products (
  slug, name, brand_id, category_id, line_id, routine_step, summary, price_ars, volume,
  key_ingredients, benefits, usage_steps, skin_types, warnings, usage_time, faqs, stock, status
)
select
  p.slug, p.name, b.id, c.id, l.id, p.routine_step, p.summary, p.price_ars, p.volume,
  p.key_ingredients, p.benefits, p.usage_steps, p.skin_types, p.warnings, p.usage_time, p.faqs::jsonb, p.stock, 'published'
from (values
  (
    'light-cleansing-oil', 'Light Cleansing Oil', 'limpieza', 'madagascar-centella', 1::smallint,
    'Aceite limpiador de textura ligera, parecida al agua, ideal para quienes recién empiezan con limpiadores en aceite.',
    32900, '200 ml',
    'Extracto de Centella Asiática y 6 aceites de origen vegetal.',
    array['Remueve el maquillaje y los residuos que quedan en la piel', 'Elimina el exceso de grasa sin quitar los aceites saludables de la piel', 'Textura ligera, adecuada para quienes se inician en los limpiadores en aceite', 'No comedogénico: disuelve el sebo y ayuda a evitar la congestión de los poros'],
    array['Bombeá una cantidad adecuada en las manos y aplicá sobre todo el rostro, masajeando suavemente.', 'A medida que el maquillaje se disuelve, emulsioná el aceite sumando agua de a poco.', 'Masajeá hasta que se vuelva lechoso y enjuagá con agua tibia.'],
    array['La mayoría de los tipos de piel'],
    'Evitar el contacto con los ojos. Suspender el uso ante signos de irritación.',
    null,
    '[{"q": "¿Sirve si nunca usé un limpiador en aceite?", "a": "Según el fabricante, tiene una textura ligera, similar al agua, adecuada para quienes recién se inician en los limpiadores en aceite."}, {"q": "¿Es comedogénico?", "a": "El fabricante lo indica como no comedogénico: disuelve el sebo y ayuda a evitar la congestión de los poros."}]',
    14
  ),
  (
    'ampoule-foam', 'Ampoule Foam', 'limpieza', 'madagascar-centella', 1::smallint,
    'Limpiador en espuma de pH 5, con un acabado suave e hidratante.',
    24900, '125 ml',
    'Extracto de Centella Asiática y bicarbonato de sodio.',
    array['Limpiador en espuma ligeramente ácido, con pH 5', 'Genera una espuma delicada de acabado suave e hidratante', 'Contiene 30% de ampoule de Centella, que calma y equilibra la piel', 'Con derivados del coco que limpian suavemente e hidratan'],
    array['Poné una cantidad adecuada en las manos húmedas y frotá para crear espuma.', 'Masajeá suavemente el rostro para limpiar y enjuagá bien con agua tibia.'],
    array['La mayoría de los tipos de piel'],
    'Evitar el contacto con los ojos.',
    null,
    '[{"q": "¿Qué pH tiene?", "a": "El fabricante indica un pH 5, ligeramente ácido."}]',
    9
  ),
  (
    'toning-toner', 'Toning Toner', 'tonicos', 'madagascar-centella', 2::smallint,
    'Tónico exfoliante suave, de textura ligera y acuosa, para usar todos los días.',
    29900, '210 ml',
    'Extracto de Centella Asiática, PHA (gluconolactona) y ácido hialurónico.',
    array['Con 84% de extracto de Centella Asiática', 'El PHA actúa de forma gradual y elimina con delicadeza el sebo y las células muertas', 'Deja la piel suave y elástica', 'Con prueba de no comedogenicidad, pensado para todo tipo de piel, incluso con acné'],
    array['Aplicá una cantidad adecuada en un disco de algodón o directamente en las palmas.', 'Pasalo por el rostro con toquecitos para que se absorba mejor.'],
    array['Todo tipo de piel', 'Piel con acné'],
    'Hacer una prueba en una zona pequeña antes del primer uso.',
    null,
    '[{"q": "¿Se puede usar todos los días?", "a": "El fabricante lo describe como un tónico de uso diario."}, {"q": "¿Es apto para piel con acné?", "a": "Según el fabricante, tiene prueba de no comedogenicidad y está pensado para todo tipo de piel, incluso con acné."}]',
    11
  ),
  (
    'centella-ampoule', 'Centella Ampoule', 'tratamiento', 'madagascar-centella', 2::smallint,
    'Ampolla de textura acuosa y no pegajosa, con 100% extracto de Centella Asiática de Madagascar.',
    38900, '55 ml',
    'Extracto de Centella Asiática.',
    array['100% extracto de Centella Asiática de la naturaleza pura de Madagascar', 'Es el producto más vendido de la marca', 'Textura ligera y acuosa, de fórmula no pegajosa', 'Calma e hidrata la piel sensible'],
    array['Después de limpiar el rostro y aplicar el tónico, tomá una cantidad adecuada con el gotero.', 'Extendela por la piel y dá suaves toques para que se absorba.'],
    array['Piel sensible'],
    'Hacer una prueba en una zona pequeña antes del primer uso.',
    null,
    '[]',
    3
  ),
  (
    'soothing-cream', 'Soothing Cream', 'hidratacion', 'madagascar-centella', 2::smallint,
    'Crema calmante de textura gel, ligera y no pegajosa, diseñada para pieles sensibles.',
    33900, '75 ml',
    'Extracto de Centella Asiática, ceramida, ácido graso y colesterol.',
    array['Fórmula calmante diseñada para pieles sensibles', 'Ceramida, colesterol y ácidos grasos ayudan a restaurar la barrera cutánea y a mejorar la hidratación', 'Contiene 72% de Centella Asiática de Madagascar, altamente purificada', 'Textura de gel hidratante que se desliza suavemente sobre la piel'],
    array['Aplicá una cantidad adecuada en el rostro y dá suaves toquecitos con ambas palmas para facilitar la absorción.'],
    array['Piel sensible'],
    'Evitar el contacto con los ojos.',
    null,
    '[]',
    0
  ),
  (
    'air-fit-suncream-plus', 'Air-Fit Suncream Plus SPF 50+', 'proteccion-solar', 'madagascar-centella', 3::smallint,
    'Protector solar mineral SPF 50+ PA++++, con acabado mate y efecto de tono natural.',
    31900, '50 ml',
    'Extracto de Centella Asiática, niacinamida, MadeWhite y Multiex BASAM.',
    array['Protector solar físico (mineral) con SPF 50+ y PA++++', 'Efecto de tono natural y acabado mate', 'Aplicación suave, con mínima formación de residuos blancos', 'Con niacinamida: combina protección UV con cuidado de la piel', 'Calma la piel con extracto de Centella Asiática'],
    array['En el último paso de tu rutina, aplicá de manera uniforme en las zonas expuestas a los rayos UV.'],
    array['Todo tipo de piel'],
    'Uso externo. No reemplaza otras medidas de protección solar.',
    'morning',
    '[{"q": "¿Es un protector físico o químico?", "a": "Es un protector solar físico (mineral), según el fabricante."}, {"q": "¿Deja residuos blancos?", "a": "El fabricante indica una aplicación suave, con mínima formación de residuos blancos."}]',
    17
  ),
  (
    'hyalu-cica-first-ampoule', 'Hyalu-Cica First Ampoule', 'tratamiento', null, null,
    'Ampolla hidratante de textura acuosa que humecta la piel y la prepara para el siguiente paso de la rutina.',
    36900, '50 ml',
    'Fórmula Hyalu-Cica (ácido hialurónico y centella), Comparex, jugo de Betula Platyphylla Japonica y extracto de Anastatica hierochuntica.',
    array['Humecta rápidamente la piel y la prepara para absorber lo que sigue', 'Alta concentración de la fórmula Hyalu-Cica, que calma e hidrata', 'Textura acuosa que facilita la aplicación y se absorbe rápido', 'Pensada para la piel seca e irritada'],
    array['Aplicá una cantidad adecuada en el rostro y dá suaves toquecitos con ambas palmas para facilitar la absorción.'],
    array['Piel seca', 'Piel irritada'],
    'Hacer una prueba en una zona pequeña antes del primer uso.',
    null,
    '[]',
    6
  ),
  (
    'hyalu-cica-moisture-cream', 'Hyalu-Cica Moisture Cream', 'hidratacion', null, null,
    'Crema hidratante que combina gel y crema, para la piel seca y sensible.',
    35900, '75 ml',
    'Fórmula Hyalu-Cica (ácido hialurónico y centella) y colágeno de origen vegetal.',
    array['Fórmula combinada de gel y crema', 'Hidratación profunda y duradera', 'La fórmula Hyalu-Cica calma e hidrata la piel seca y sensible', 'Con colágeno de origen vegetal'],
    array['Aplicá y distribuí suavemente sobre la piel, como último paso de tu rutina de cuidado, y dá ligeros toques para que se absorba.'],
    array['Piel seca', 'Piel sensible'],
    'Evitar el contacto con los ojos.',
    null,
    '[]',
    8
  )
) as p (slug, name, category_slug, line_slug, routine_step, summary, price_ars, volume,
        key_ingredients, benefits, usage_steps, skin_types, warnings, usage_time, faqs, stock)
join public.brands b on b.slug = 'skin1004'
join public.categories c on c.slug = p.category_slug
left join public.product_lines l on l.slug = p.line_slug and l.brand_id = b.id;
