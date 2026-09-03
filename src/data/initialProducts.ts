import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Set de Aros Dorados Clásicos Argollas Acero Quirúrgico',
    description: 'Clásicas argollas de acero quirúrgico, ideales para el uso diario. Hipoalergénicas y resistentes al agua.\n\n- Material: Acero Quirúrgico 316L\n- Diámetro: 20mm (Mediano), 30mm (Grande)\n- Color: Dorado / Plateado\n- Cierre: Tipo italiano, súper seguro.\n\nExcelente opción para revendedores por su alta rotación.',
    category: 'Bijuteria',
    subcategory: 'Aros',
    images: [
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 3,
    wholesalePrice: 1250,
    retailPrice: 1800,
    colors: ['Dorado', 'Plateado'],
    sizeVariants: [
      { id: 'size-m', name: 'Mediano', wholesalePrice: 1250, retailPrice: 1800, sku: 'ARO-MED-01' },
      { id: 'size-g', name: 'Grande', wholesalePrice: 1650, retailPrice: 2400, sku: 'ARO-GRA-02' }
    ],
    variantTypes: [
      {
        id: 'vt-color',
        name: 'Color / Acabado',
        options: [
          {
            id: 'opt-dorado',
            name: 'Dorado',
            images: [
              'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-plateado',
            name: 'Plateado',
            images: [
              'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&auto=format&fit=crop&q=80'
            ]
          }
        ]
      },
      {
        id: 'vt-size',
        name: 'Tamaño / Medida',
        options: [
          {
            id: 'size-m',
            name: 'Mediano (20mm)',
            wholesalePrice: 1250,
            retailPrice: 1800,
            sku: 'ARO-MED-01',
            images: []
          },
          {
            id: 'size-g',
            name: 'Grande (30mm)',
            wholesalePrice: 1650,
            retailPrice: 2400,
            sku: 'ARO-GRA-02',
            images: []
          }
        ]
      }
    ],
    stock: 240,
    soldCount: 5240,
    rating: 5.0,
    reviewsCount: 128,
    isBestSeller: true,
    specs: [
      { label: 'Material', value: 'Acero Quirúrgico 316L' },
      { label: 'Diámetro', value: '20mm (Mediano), 30mm (Grande)' },
      { label: 'Color', value: 'Dorado / Plateado' },
      { label: 'Cierre', value: 'Tipo italiano, súper seguro' }
    ]
  },
  {
    id: 'prod-2',
    title: 'Collar de Plata 925 con Dije Corazón',
    description: 'Hermoso collar confeccionado en auténtica Plata 925 con acabado pulido brillante y dije de corazón engarzado con circones micro-pavé de primera calidad.\n\n- Incluye cadena de 45cm extensible a 50cm\n- Hipoalergénico libre de níquel\n- Presentación en estuche individual de regalo',
    category: 'Bijuteria',
    subcategory: 'Collares',
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 12,
    wholesalePrice: 51000,
    retailPrice: 75000,
    colors: ['Plata Brillante', 'Oro Rosa'],
    sizeVariants: [
      { id: 'size-45', name: 'Cadena 45cm', wholesalePrice: 51000, retailPrice: 75000 },
      { id: 'size-55', name: 'Cadena 55cm', wholesalePrice: 56000, retailPrice: 82000 }
    ],
    stock: 95,
    soldCount: 1200,
    rating: 4.9,
    reviewsCount: 64,
    isBestSeller: true,
    specs: [
      { label: 'Metal', value: 'Plata 925 sellada' },
      { label: 'Piedra', value: 'Circón cúbico AAA' },
      { label: 'Largo', value: '45 cm' }
    ]
  },
  {
    id: 'prod-3',
    title: 'Reloj Hombre Cronógrafo Acero Inoxidable Sumergible',
    description: 'Reloj analógico masculino con esfera azul metalizada, calendario multifunción y cronógrafo de alta precisión. Caja y malla de acero quirúrgico macizo inoxidable.',
    category: 'Tecnología',
    subcategory: 'Relojes',
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 3,
    wholesalePrice: 2500,
    retailPrice: 3800,
    colors: ['Azul / Acero', 'Negro / Cuero', 'Plateado'],
    sizeVariants: [
      { id: 'size-std', name: 'Estándar 42mm', wholesalePrice: 2500, retailPrice: 3800 },
      { id: 'size-xl', name: 'Oversize 46mm', wholesalePrice: 3100, retailPrice: 4600 }
    ],
    variantTypes: [
      {
        id: 'vt-model',
        name: 'Modelo / Color',
        options: [
          {
            id: 'opt-azul',
            name: 'Azul / Acero',
            images: [
              'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-negro',
            name: 'Negro / Cuero',
            images: [
              'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-plateado-reloj',
            name: 'Plateado',
            images: [
              'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
            ]
          }
        ]
      },
      {
        id: 'vt-size',
        name: 'Tamaño de Caja',
        options: [
          {
            id: 'size-std',
            name: 'Estándar 42mm',
            wholesalePrice: 2500,
            retailPrice: 3800,
            images: []
          },
          {
            id: 'size-xl',
            name: 'Oversize 46mm',
            wholesalePrice: 3100,
            retailPrice: 4600,
            images: []
          }
        ]
      }
    ],
    stock: 60,
    soldCount: 380,
    rating: 4.8,
    reviewsCount: 42,
    isBestSeller: true,
    specs: [
      { label: 'Movimiento', value: 'Cuarzo Japonés Seiko Epson' },
      { label: 'Resistencia al agua', value: '50 metros (5 ATM)' },
      { label: 'Cristal', value: 'Mineral endurecido Hardlex' }
    ]
  },
  {
    id: 'prod-4',
    title: 'Bloques Armables Auto Deportivo 300 Pcs',
    description: 'Set de construcción de bloques tipo Lego compatible de auto superdeportivo con 300 piezas de alta precisión y stickers decorativos. Excelente para estimulación creativa.',
    category: 'Juguetes',
    subcategory: 'Bloques',
    images: [
      'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563941402622-4e7a488bcc57?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516981879613-9f5da904015f?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 3,
    wholesalePrice: 1200,
    retailPrice: 1800,
    colors: ['Rojo Deportivo', 'Azul Eléctrico', 'Amarillo'],
    variantTypes: [
      {
        id: 'vt-color-auto',
        name: 'Color / Modelo',
        options: [
          {
            id: 'opt-rojo',
            name: 'Rojo Deportivo',
            images: [
              'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-azul',
            name: 'Azul Eléctrico',
            images: [
              'https://images.unsplash.com/photo-1563941402622-4e7a488bcc57?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1516981879613-9f5da904015f?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-amarillo',
            name: 'Amarillo',
            images: [
              'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&auto=format&fit=crop&q=80'
            ]
          }
        ]
      }
    ],
    sizeVariants: [
      { id: 'size-300', name: '300 Piezas', wholesalePrice: 1200, retailPrice: 1800 },
      { id: 'size-600', name: '600 Piezas Motorizado', wholesalePrice: 2400, retailPrice: 3500 }
    ],
    stock: 150,
    soldCount: 840,
    rating: 5.0,
    reviewsCount: 96,
    isBestSeller: true,
    specs: [
      { label: 'Edad recomendada', value: '+6 años' },
      { label: 'Cantidad de piezas', value: '300 pcs' },
      { label: 'Material', value: 'Plástico ABS no tóxico' }
    ]
  },
  {
    id: 'prod-5',
    title: 'Oso de Peluche Gigante 1 Metro Ultra Suave',
    description: 'Oso de peluche gigante con lazo satinado, confeccionado con felpa ultra suave hipoalergénica de fibra siliconada que no pierde su forma.',
    category: 'Juguetes',
    subcategory: 'Peluches',
    images: [
      'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1530325553241-4f6e7690cf36?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563941402622-4e7a488bcc57?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516981879613-9f5da904015f?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 2,
    wholesalePrice: 12000,
    retailPrice: 18000,
    colors: ['Marrón Clásico', 'Beige Crema', 'Rosa Pastel'],
    sizeVariants: [
      { id: 'size-100', name: '100 cm (1 Metro)', wholesalePrice: 12000, retailPrice: 18000 },
      { id: 'size-150', name: '150 cm (1.5 Metros)', wholesalePrice: 18500, retailPrice: 27000 }
    ],
    stock: 45,
    soldCount: 310,
    rating: 4.9,
    reviewsCount: 53,
    isBestSeller: true,
    specs: [
      { label: 'Altura', value: '100 cm sentado' },
      { label: 'Relleno', value: 'Vellón siliconado 100% virgen' },
      { label: 'Lavable', value: 'Sí, funda desmontable' }
    ]
  },
  {
    id: 'prod-6',
    title: 'Reloj Inteligente Smartwatch Deportivo Bluetooth',
    description: 'Smartwatch multifunción con monitor de ritmo cardíaco, presión arterial, contador de pasos, modos deportivos múltiples, recepción de notificaciones de WhatsApp y llamadas.',
    category: 'Tecnología',
    subcategory: 'Smartwatch',
    images: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 5,
    wholesalePrice: 12500,
    retailPrice: 18500,
    colors: ['Negro Malla Silicona', 'Rosa Oro', 'Plata Malla Metálica'],
    sizeVariants: [
      { id: 'size-40', name: 'Pantalla 1.4"', wholesalePrice: 12500, retailPrice: 18500 },
      { id: 'size-44', name: 'Pantalla 1.8" HD AMOLED', wholesalePrice: 16500, retailPrice: 23900 }
    ],
    stock: 80,
    soldCount: 920,
    rating: 4.8,
    reviewsCount: 110,
    isBestSeller: true,
    specs: [
      { label: 'Compatibilidad', value: 'Android 5.0+ / iOS 9.0+' },
      { label: 'Batería', value: 'Hasta 7 días de uso continuo' },
      { label: 'Protección', value: 'IP68 resistente a salpicaduras' }
    ]
  },
  {
    id: 'prod-7',
    title: 'Auriculares Inalámbricos Bluetooth 5.0 con Estuche Powerbank',
    description: 'Auriculares True Wireless Stereo (TWS) con sonido envolvente Hi-Fi, cancelación pasiva de ruido, micrófono HD incorporado y estuche de carga con display LED de batería.',
    category: 'Tecnología',
    subcategory: 'Audio',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 5,
    wholesalePrice: 8500,
    retailPrice: 12500,
    colors: ['Blanco', 'Negro Mate'],
    variantTypes: [
      {
        id: 'vt-audio-color',
        name: 'Color',
        options: [
          {
            id: 'opt-blanco',
            name: 'Blanco',
            images: [
              'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80'
            ]
          },
          {
            id: 'opt-negro',
            name: 'Negro Mate',
            images: [
              'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80'
            ]
          }
        ]
      }
    ],
    sizeVariants: [
      { id: 'size-std-tws', name: 'Estándar TWS', wholesalePrice: 8500, retailPrice: 12500 },
      { id: 'size-pro-anc', name: 'Versión Pro con ANC', wholesalePrice: 12000, retailPrice: 17500 }
    ],
    stock: 120,
    soldCount: 1450,
    rating: 4.7,
    reviewsCount: 88,
    isBestSeller: true,
    specs: [
      { label: 'Bluetooth', value: 'Versión 5.3 + EDR' },
      { label: 'Autonomía', value: '6 horas continuas + 24 hs en estuche' },
      { label: 'Control', value: 'Panel táctil Smart Touch' }
    ]
  },
  {
    id: 'prod-8',
    title: 'Perfume Importado Eau de Parfum Floral Delux 100ml',
    description: 'Exquisita fragancia floral frutal con notas de salida de bergamota y mandarina, corazón de jazmín sambac y fondo avainillado de ámbar y pachulí. Larga fijación garantizada.',
    category: 'Perfumes',
    subcategory: 'Fragancias',
    images: [
      'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 4,
    wholesalePrice: 9800,
    retailPrice: 15000,
    colors: ['Frasco Cristal Ámbar', 'Edición Rosa Gold'],
    sizeVariants: [
      { id: 'size-50ml', name: '50 ml Spray', wholesalePrice: 6500, retailPrice: 9900 },
      { id: 'size-100ml', name: '100 ml Spray', wholesalePrice: 9800, retailPrice: 15000 }
    ],
    stock: 70,
    soldCount: 610,
    rating: 4.9,
    reviewsCount: 75,
    isBestSeller: false,
    specs: [
      { label: 'Concentración', value: 'Eau de Parfum (EDP)' },
      { label: 'Duración', value: '+12 horas de fijación' },
      { label: 'Origen', value: 'Importado direct factory' }
    ]
  },
  {
    id: 'prod-9',
    title: 'Remera Lisa Algodón Premium Calidad Mayorista - Unisex',
    description: 'Remera básica confeccionada en 100% algodón peinado 24/1 de máxima suavidad y durabilidad. Costuras reforzadas de hombro a hombro, no se deforma ni destiñe con los lavados.',
    category: 'Bijuteria',
    subcategory: 'Textil',
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=80'
    ],
    minWholesaleQty: 10,
    wholesalePrice: 3500,
    retailPrice: 5500,
    colors: ['Blanco', 'Negro', 'Gris Melange', 'Azul Marino'],
    sizeVariants: [
      { id: 'size-s', name: 'Talle S', wholesalePrice: 3500, retailPrice: 5500 },
      { id: 'size-m', name: 'Talle M', wholesalePrice: 3500, retailPrice: 5500 },
      { id: 'size-l', name: 'Talle L', wholesalePrice: 3700, retailPrice: 5800 },
      { id: 'size-xl', name: 'Talle XL', wholesalePrice: 3900, retailPrice: 6200 }
    ],
    stock: 500,
    soldCount: 4200,
    rating: 4.9,
    reviewsCount: 180,
    isBestSeller: true,
    specs: [
      { label: 'Composición', value: '100% Algodón Peinado 24/1' },
      { label: 'Corte', value: 'Regular Fit Unisex' },
      { label: 'Cuello', value: 'Ribb con refuerzo de limpieza' }
    ]
  }
];
