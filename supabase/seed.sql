-- Test data for the gallery. Safe to re-run: clears existing rows first.
truncate table paintings;

insert into paintings (title, medium, description, images) values
(
  'Quiet Harbor',
  'Oil on canvas, 24 x 36 in',
  'A study of late afternoon light over a sheltered cove. Worked over three sessions on location.',
  array[
    'https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=1200',
    'https://images.unsplash.com/photo-1579541814924-49fef17c5be5?w=1200',
    'https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=1200'
  ]
),
(
  'Field Notes',
  'Watercolor on paper, 11 x 14 in',
  'Quick plein-air sketch from a wheat field in early summer.',
  array[
    'https://images.unsplash.com/photo-1582561424557-058531e8a665?w=1200',
    'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1200'
  ]
),
(
  'Untitled (Red)',
  'Acrylic on linen, 48 x 48 in',
  'Part of an ongoing series exploring color field compositions.',
  array[
    'https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=1200'
  ]
),
(
  'Studio Morning',
  'Charcoal on paper, 18 x 24 in',
  'Interior study, north-facing window.',
  array[
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200',
    'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1200'
  ]
),
(
  'Coastal Edge',
  'Oil on panel, 16 x 20 in',
  'A small panel done from a single sitting along the cliffs.',
  array[
    'https://images.unsplash.com/photo-1552084117-56a987666449?w=1200'
  ]
),
(
  'Garden in October',
  'Pastel on paper, 14 x 17 in',
  'Late season — most flowers gone, focus on architecture of the bare beds.',
  array[
    'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200',
    'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200'
  ]
);
