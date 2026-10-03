(function(){
  const meterRanges = {
    8:[40,60],9:[50,70],10:[60,80],11:[65,85],12:[70,95],13:[80,105],14:[90,120],15:[105,150],16:[120,180],17:[150,200],18:[180,220],19:[200,250],20:[220,280],21:[250,300],22:[280,330],23:[300,350],24:[320,370],25:[350,410],26:[380,440],27:[410,480],28:[440,520],29:[480,570],30:[520,620]
  };

  function adultSizes(from,to,height){
    const out=[];
    for(let ru=from;ru<=to;ru+=2) out.push({label:String(ru),ruSize:ru,chest:ru*2,height});
    return out;
  }

  // Базовые детские типовые фигуры для расчётной сетки: рост + ориентир ОГ.
  // В стандартах одному росту могут соответствовать несколько полнот; значения ниже — базовая линия интерфейса,
  // которую пользователь при необходимости уточняет через размеры готового изделия.
  const childSizes = [
    [86,52],[92,52],[98,56],[104,56],[110,60],[116,60],[122,64],[128,64],
    [134,68],[140,72],[146,76],[152,80],[158,84],[164,88]
  ].map(([height,chest])=>({label:String(height),height,chest,child:true}));

  const garments = [
    {id:'child_cardigan',name:'Детский жакет',icon:'cardigan',child:true,sex:'child',geometry:'torso',variant:'cardigan',ease:8,sizes:childSizes},
    {id:'child_pullover',name:'Детский пуловер',icon:'pullover',child:true,sex:'child',geometry:'torso',variant:'pullover',ease:6,sizes:childSizes},
    {id:'child_sweater',name:'Детский свитер',icon:'sweater',child:true,sex:'child',geometry:'torso',variant:'sweater',ease:8,sizes:childSizes},
    {id:'child_vest',name:'Детский жилет',icon:'vest',child:true,sex:'child',geometry:'torso',variant:'vest',ease:6,sizes:childSizes},
    {id:'child_socks',name:'Детские носки',icon:'socks',child:true,geometry:'socks',sizes:[
      {label:'20–22',foot:14,circ:15,leg:12},{label:'23–25',foot:16,circ:16,leg:14},{label:'26–28',foot:18,circ:17,leg:15},
      {label:'29–31',foot:20,circ:18,leg:16},{label:'32–34',foot:22,circ:19,leg:17},{label:'35–36',foot:23,circ:20,leg:18}
    ]},

    {id:'women_cardigan',name:'Женский жакет',icon:'cardigan',sex:'women',geometry:'torso',variant:'cardigan',ease:12,sizes:adultSizes(40,66,164)},
    {id:'women_pullover',name:'Женский пуловер',icon:'pullover',sex:'women',geometry:'torso',variant:'pullover',ease:8,sizes:adultSizes(40,66,164)},
    {id:'women_sweater',name:'Женский свитер',icon:'sweater',sex:'women',geometry:'torso',variant:'sweater',ease:10,sizes:adultSizes(40,66,164)},
    {id:'women_vest',name:'Женский жилет',icon:'vest',sex:'women',geometry:'torso',variant:'vest',ease:6,sizes:adultSizes(40,66,164)},

    {id:'men_cardigan',name:'Мужской жакет',icon:'cardigan',sex:'men',geometry:'torso',variant:'cardigan',ease:14,sizes:adultSizes(42,66,176)},
    {id:'men_pullover',name:'Мужской пуловер',icon:'pullover',sex:'men',geometry:'torso',variant:'pullover',ease:10,sizes:adultSizes(42,66,176)},
    {id:'men_sweater',name:'Мужской свитер',icon:'sweater',sex:'men',geometry:'torso',variant:'sweater',ease:12,sizes:adultSizes(42,66,176)},
    {id:'men_vest',name:'Мужской жилет',icon:'vest',sex:'men',geometry:'torso',variant:'vest',ease:8,sizes:adultSizes(42,66,176)},

    {id:'hat',name:'Шапка',icon:'hat',geometry:'hat',sizes:[
      {label:'50',head:50,height:20},{label:'52',head:52,height:20.5},{label:'54',head:54,height:21},{label:'56',head:56,height:21.5},{label:'58',head:58,height:22},{label:'60',head:60,height:22.5}
    ]},
    {id:'mittens',name:'Рукавицы и перчатки',icon:'mittens',geometry:'mittens',sizes:[
      {label:'S',handCirc:18,handLength:18},{label:'M',handCirc:20,handLength:19},{label:'L',handCirc:22,handLength:20.5},{label:'XL',handCirc:24,handLength:22}
    ]},
    {id:'socks',name:'Носки',icon:'socks',geometry:'socks',sizes:[
      {label:'35–36',foot:23,circ:20.5,leg:18},{label:'37–38',foot:24.5,circ:21.5,leg:19},{label:'39–40',foot:26,circ:22.5,leg:20},
      {label:'41–42',foot:27.5,circ:23.5,leg:21},{label:'43–44',foot:29,circ:24.5,leg:22},{label:'45–46',foot:30.5,circ:25.5,leg:23}
    ]},
    {id:'scarf',name:'Шарф',icon:'scarf',geometry:'rectangle',sizes:[
      {label:'20×140',width:20,height:140},{label:'20×180',width:20,height:180},{label:'25×180',width:25,height:180},{label:'30×180',width:30,height:180},{label:'30×200',width:30,height:200}
    ]},
    {id:'shawl',name:'Платок / шаль',icon:'shawl',geometry:'triangle',sizes:[
      {label:'120×60',width:120,height:60},{label:'150×75',width:150,height:75},{label:'180×90',width:180,height:90},{label:'200×100',width:200,height:100}
    ]},
    {id:'blanket',name:'Одеяло',icon:'blanket',geometry:'rectangle',sizes:[
      {label:'70×90',width:70,height:90},{label:'80×100',width:80,height:100},{label:'100×120',width:100,height:120},{label:'120×150',width:120,height:150},{label:'150×200',width:150,height:200},{label:'180×200',width:180,height:200}
    ]}
  ];

  const sampleDescriptions = [
    'Италия. Cariaggi. Art. T2000 Cashmere plus. Col. C2425 navy (темно-синий). 100% кашемир. 100г/1400м (1/28). В наличии 97г. 100г/1190 руб.',
    'Италия. Stock yarn italy. Galicia. Col. Classic blue (классический синий, припыленный джинс). 50% беби верблюд, 50% меринос. 100г/550м (2/11). В наличии 870г. 100г/720 руб.',
    'Италия. Stock Yarn. Paillettes 100 WV. Цвет золотая горчица, медовый, янтарный. 100% гребенной меринос экстрафайн с пайетками. 100г/500м.'
  ];

  window.MANIA_DATA={
    meterRanges,garments,sampleDescriptions,reserve:0.10,
    standards:{womenReferenceHeight:164,menReferenceHeight:176,interHeightStep:6,garmentLengthStep:4,sleeveLengthStep:4}
  };
})();
