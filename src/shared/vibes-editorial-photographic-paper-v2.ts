/** Structured, project-copyable form of docs/vibes/ESTILO_APROBADO.md. */
export const VIBES_EDITORIAL_PHOTOGRAPHIC_PAPER_V2 = {
  id: 'vibes-editorial-photographic-paper@2.0.0',
  name: 'COLLAGE EDITORIAL FOTOGRÁFICO DE PAPEL',
  approval: 'user-approved-direction',
  scope: 'Vibes images and image-to-video; this profile stays separate from Animation Visuales.',
  referencePolicy: 'References define material, contrast, crop, and hierarchy; do not copy their subject or layout.',
  visualReferenceSummary: [
    'Use project-specific references only to infer material, contrast, crop, and hierarchy.',
    'Do not copy reference subjects or composition unless the narration explicitly requires them.',
  ],
  format: { orientation: 'vertical', aspectRatio: '9:16' },
  finish: {
    photography: 'Predominantly black-and-white photography with crisp, recognizable detail and clear contrast.',
    paperTexture: 'Subtle print and photocopy grain; restrained rather than aged or distressed.',
    cutEdges: 'Natural narrow or moderate white paper edges; short, shallow shadows that read as layered paper, not floating 3D objects.',
    lighting: 'Defined photographic contrast with soft, short paper shadows; avoid glossy, theatrical, or volumetric 3D lighting.',
    tone: 'Mature, explanatory editorial art direction; contemporary objects are allowed.',
  },
  palette: {
    ivory: { hex: '#F2EBDD', use: 'clarity and documentary context' },
    burntOrange: { hex: '#C85B32', use: 'limited emphasis and energy' },
    mutedTeal: { hex: '#477C78', use: 'context and documentary grounding' },
    navy: { hex: '#10253B', use: 'serious analysis' },
    accentRule: 'Use restrained accents only when they clarify a relationship.',
  },
  composition: {
    allowedMaterials: [
      'Silhouette-cut photographic objects.',
      'Rectangular photographs with a white margin.',
      'Photographs on torn paper.',
      'Small secondary photographic cutouts.',
      'Simple, flat conceptual diagrams on paper.',
    ],
    lightingHierarchy: 'Keep the main photographic subject recognizable and high contrast; supporting elements stay smaller and explain a specific relationship.',
    variety: 'Choose subject, supports, scale, position, framing, cut type, paper color, and accent for the idea. Do not repeat one layout with only its object changed.',
    narrativeCheck: [
      'State the one idea the viewer should understand.',
      'Name the object or image that represents that idea.',
      'Give each support a specific explanatory job.',
      'Make the visual relationship readable.',
      'Remove decorative elements with no narrative purpose.',
    ],
  },
  restrictions: [
    'No people, faces, hands, or human silhouettes.',
    'Non-graphic educational anatomical models are allowed only when the topic calls for them.',
    'No readable text, numbers, labels, or requested logos.',
    'No childish style, toys, glossy 3D icons, or vector-art protagonists.',
    'No plants or unrelated decoration.',
    'Do not request or reproduce reference watermarks; the service may add its own watermark.',
    'Do not present conceptual diagrams as scientific measurements.',
  ],
  animation: {
    phase: 'available-for-explicit-image-to-video',
    rule: 'Keep the complete principal photographic subject fully in frame and still. Keep background and camera fixed. Animate only supporting graphic elements explicitly named for motion; if none are named, keep the image still. No zoom, pan, cut, morph, parallax, subject movement, or background movement.',
  },
} as const

export type VibesEditorialPhotographicPaperProfileV2 = typeof VIBES_EDITORIAL_PHOTOGRAPHIC_PAPER_V2
