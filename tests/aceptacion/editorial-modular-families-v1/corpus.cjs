// Fixed semantic corpus: five genuinely distinct narratives per family.
// Codes resolve against the SHA-pinned 250-piece inventory at run time.
module.exports=[
  {id:'E01',family:'marcoPoster',hero:'H001',supports:['S001','S002','S003','S004'],title:['UNA','IDEA','abre nuevas posibilidades'],relations:[['support-1','hero','informs'],['support-2','hero','informs'],['hero','support-3','causes'],['support-3','support-4','causes']]},
  {id:'E02',family:'marcoPoster',hero:'H011',supports:['S005','S006','S025'],title:['LA','SEÑAL','viaja por la red'],relations:[['support-1','hero','informs'],['hero','support-2','transfers']]},
  {id:'E03',family:'marcoPoster',hero:'H101',supports:['S049','S050','S048'],title:['LAS','PIEZAS','forman un sistema'],relations:[['support-1','hero','causes'],['hero','support-2','causes']]},
  {id:'E04',family:'marcoPoster',hero:'H061',supports:['S033','S034','S036'],title:['UNA','SEMILLA','responde al agua y al clima'],relations:[['support-1','hero','causes'],['support-3','hero','informs']]},
  {id:'E05',family:'marcoPoster',hero:'H020',supports:['S005','S027','S025'],title:['EL','CINE','proyecta y comunica historias'],relations:[['support-1','hero','informs'],['hero','support-2','causes']]},

  {id:'E06',family:'editorial',title:['EL','CAMBIO','empieza con una pregunta']},
  {id:'E07',family:'editorial',title:['PENSAR','DISTINTO','también es una herramienta']},
  {id:'E08',family:'editorial',title:['UNA','DECISIÓN','transforma el siguiente paso']},
  {id:'E09',family:'editorial',title:['MÁS','CLARO','para comprender mejor']},
  {id:'E10',family:'editorial',title:['EL','FUTURO','se construye con criterio']},

  {id:'E11',family:'partidoVertical',hero:'H025',supports:['S040','S042','S021'],title:['LA','RED','conecta cómputo y nube'],relations:[['support-1','hero','connects'],['hero','support-2','connects']]},
  {id:'E12',family:'partidoVertical',hero:'H121',supports:['S043','S045','S002'],title:['EL','AHORRO','frente al intercambio'],relations:[['hero','support-2','compares']]},
  {id:'E13',family:'partidoVertical',hero:'H059',supports:['S038','S019','S013'],title:['LA','INVESTIGACIÓN','necesita verificar resultados'],relations:[['support-1','hero','informs'],['hero','support-2','causes']]},
  {id:'E14',family:'partidoVertical',hero:'H147',supports:['S001','S023','S021'],title:['LA','JUSTICIA','protege a las personas'],relations:[['hero','support-1','causes']]},
  {id:'E15',family:'partidoVertical',hero:'H071',supports:['S031','S032','S004'],title:['LA','ENERGÍA','se almacena para después'],relations:[['hero','support-2','transfers']]},

  {id:'E16',family:'cuaderno',hero:'H006',supports:['S014','S015','S019'],title:['LA','ESCRITURA','guarda y ordena ideas'],relations:[['support-2','hero','informs']]},
  {id:'E17',family:'cuaderno',hero:'H132',supports:['S038','S013','S014'],title:['LA','ARQUEOLOGÍA','investiga nuestra memoria'],relations:[['support-2','hero','informs']]},
  {id:'E18',family:'cuaderno',hero:'H127',supports:['S023','S019','S017'],title:['UN','CONTRATO','requiere identidad y validación'],relations:[['support-1','hero','informs'],['support-2','hero','informs']]},
  {id:'E19',family:'cuaderno',hero:'H139',supports:['S013','S018','S038'],title:['UN','HALLAZGO','abre una investigación'],relations:[['hero','support-1','causes']]},
  {id:'E20',family:'cuaderno',hero:'H136',supports:['S014','S048','S015'],title:['EL','PATRIMONIO','merece memoria y cuidado'],relations:[['support-1','hero','informs']]},

  {id:'E21',family:'constelacion',hero:'H025',supports:['S009','S025','S040','S042'],title:['UNA','RED','vincula sistemas distantes'],relations:[['support-1','hero','connects'],['hero','support-3','connects']]},
  {id:'E22',family:'constelacion',hero:'H041',supports:['S001','S009','S046'],title:['LA','COLABORACIÓN','une personas y recursos'],relations:[['support-1','hero','connects'],['hero','support-2','connects']]},
  {id:'E23',family:'constelacion',hero:'H081',supports:['S028','S025','S006'],title:['UN','SATÉLITE','conecta lugares lejanos'],relations:[['hero','support-2','transfers']]},
  {id:'E24',family:'constelacion',hero:'H052',supports:['S014','S015','S002'],title:['EL','CEREBRO','relaciona memoria y creatividad'],relations:[['support-1','hero','informs'],['hero','support-2','connects']]},
  {id:'E25',family:'constelacion',hero:'H030',supports:['S022','S021','S024'],title:['LA','IDENTIDAD','exige privacidad y acceso'],relations:[['support-1','hero','connects'],['hero','support-3','connects']]},

  {id:'E26',family:'cascada',hero:'H101',supports:['S049','S050','S048'],title:['LAS','PIEZAS','avanzan hacia la construcción'],relations:[['support-1','hero','causes'],['hero','support-2','causes'],['support-2','support-3','causes']]},
  {id:'E27',family:'cascada',hero:'H061',supports:['S033','S034','S036'],title:['UNA','SEMILLA','crece con agua y naturaleza'],relations:[['support-1','hero','causes'],['hero','support-2','causes']]},
  {id:'E28',family:'cascada',hero:'H107',supports:['S016','S049','S048'],title:['LA','FABRICACIÓN','sigue un plan y se verifica'],relations:[['support-1','hero','causes'],['hero','support-3','causes']]},
  {id:'E29',family:'cascada',hero:'H115',supports:['S029','S030','S004'],title:['UNA','ENTREGA','recorre una ruta y llega'],relations:[['support-1','hero','informs'],['hero','support-3','causes']]},
  {id:'E30',family:'cascada',hero:'H071',supports:['S031','S032','S004'],title:['LA','ELECTRICIDAD','pasa a una batería'],relations:[['hero','support-2','transfers'],['support-2','support-3','causes']]},
].map(item=>({...item,id:item.id.replace(/^E(?=\d{2}$)/,'R')}))
