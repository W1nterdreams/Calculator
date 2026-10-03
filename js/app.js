(function(){
  'use strict';

  const D=window.MANIA_DATA;
  const P=window.ManiaParser;
  const VKCAT=window.MANIA_VK_CATALOG;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const fmt=(n,d=0)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round=(n,d=1)=>Math.round(n*Math.pow(10,d))/Math.pow(10,d);

  function blankComposition(){return Array.from({length:6},()=>({percent:'',material:''}));}
  function newYarn(id){return {id,meters:'',weight:'',compositionParts:blankComposition()};}

  const state={
    yarns:[newYarn(1)],
    nextYarnId:2,
    mix:null,
    sample:null,
    garmentId:'women_pullover',
    sizeIndex:3,
    productGauge:20,
    productRowGauge:null,
    productMeterage:280,
    productDims:null,
    product:null,
    vkCatalog:[],
    vkMeta:null,
    catalogStarted:false
  };

  const els={
    consentScreen:$('#consentScreen'),app:$('#app'),consentBtn:$('#consentBtn'),vkState:$('#vkState'),toast:$('#toast'),
    yarnComponents:$('#yarnComponents'),addYarnBtn:$('#addYarnBtn'),mixResult:$('#mixResult'),resetSampleBtn:$('#resetSampleBtn'),
    sampleStitches:$('#sampleStitches'),sampleRows:$('#sampleRows'),sampleWidth:$('#sampleWidth'),sampleHeight:$('#sampleHeight'),sampleWeight:$('#sampleWeight'),sampleValidation:$('#sampleValidation'),sampleResultCard:$('#sampleResultCard'),sampleGaugeResult:$('#sampleGaugeResult'),sampleRowsGaugeResult:$('#sampleRowsGaugeResult'),areaConsumptionResult:$('#areaConsumptionResult'),areaConsumptionHint:$('#areaConsumptionHint'),sampleMeterageResult:$('#sampleMeterageResult'),sampleMetersUsedResult:$('#sampleMetersUsedResult'),useSampleBtn:$('#useSampleBtn'),
    sampleTransferStatus:$('#sampleTransferStatus'),pullSampleBtn:$('#pullSampleBtn'),garmentGrid:$('#garmentGrid'),sizeChips:$('#sizeChips'),sizeHint:$('#sizeHint'),productDimensionsCard:$('#productDimensionsCard'),productDimensionsFields:$('#productDimensionsFields'),productDimensionsHint:$('#productDimensionsHint'),productDimensionSummary:$('#productDimensionSummary'),productGauge:$('#productGauge'),productRowGauge:$('#productRowGauge'),productMeterage:$('#productMeterage'),gaugeHint:$('#gaugeHint'),productValidation:$('#productValidation'),productResultCard:$('#productResultCard'),productResultTitle:$('#productResultTitle'),productResultGrams:$('#productResultGrams'),productResultMeters:$('#productResultMeters'),productResultMeterage:$('#productResultMeterage'),productResultRawGrams:$('#productResultRawGrams'),productResultReserve:$('#productResultReserve'),productResultNote:$('#productResultNote'),compatBadge:$('#compatBadge'),
    refreshCatalogBtn:$('#refreshCatalogBtn'),catalogStatus:$('#catalogStatus'),matchEmpty:$('#matchEmpty'),matchContent:$('#matchContent'),matchSummary:$('#matchSummary'),matchGrid:$('#matchGrid')
  };

  function icon(name){return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;}
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function numeric(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null;}
  function garment(){return D.garments.find(x=>x.id===state.garmentId)||D.garments[0];}

  function switchView(name){
    $$('.tab').forEach(b=>b.classList.toggle('is-active',b.dataset.view===name));
    $$('.view').forEach(v=>v.classList.toggle('is-active',v.id==='view-'+name));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showToast(text){
    els.toast.textContent=text;els.toast.hidden=false;
    clearTimeout(showToast._t);showToast._t=setTimeout(()=>{els.toast.hidden=true;},1800);
  }

  function normalizeCompositionParts(y){
    if(!Array.isArray(y.compositionParts))y.compositionParts=[];
    while(y.compositionParts.length<6)y.compositionParts.push({percent:'',material:''});
    y.compositionParts=y.compositionParts.slice(0,6).map(x=>({percent:x?.percent??'',material:x?.material??''}));
    return y.compositionParts;
  }

  function compositionForYarn(parts){
    const clean=(parts||[]).map(x=>({material:String(x?.material||'').trim().toLowerCase(),percent:numeric(x?.percent)}))
      .filter(x=>x.material&&Number.isFinite(x.percent)&&x.percent>0);
    const sum=clean.reduce((a,x)=>a+x.percent,0);
    return {parts:clean,sum};
  }

  function compositionPairHtml(part,i){
    return `<div class="composition-pair">
      <div class="percent-input"><input data-comp-index="${i}" data-comp-field="percent" type="number" min="0" max="100" step="1" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(part.percent)}" placeholder="например, 70"><span>%</span></div>
      <input class="material-input" data-comp-index="${i}" data-comp-field="material" type="text" value="${escapeHtml(part.material)}" placeholder="например, меринос">
    </div>`;
  }

  function compositionTotalState(y){
    const comp=compositionForYarn(normalizeCompositionParts(y));
    const ok=Math.abs(comp.sum-100)<=0.15;
    return {sum:comp.sum,ok};
  }

  function renderYarns(){
    els.yarnComponents.innerHTML=state.yarns.map((y,index)=>{
      const parts=normalizeCompositionParts(y);const total=compositionTotalState(y);
      return `<article class="yarn-component" data-yarn-id="${y.id}">
        <div class="yarn-component-head"><h3>Нить ${index+1}</h3>${state.yarns.length>1?'<button class="remove-yarn" type="button" data-remove-yarn>Убрать</button>':''}</div>
        <div class="component-fields">
          <label class="field"><span>Длина</span><div class="input-unit"><input data-yarn-field="meters" type="number" min="1" step="1" inputmode="decimal" value="${escapeHtml(y.meters)}" placeholder="например, 1500"><b>м</b></div></label>
          <label class="field"><span>Вес</span><div class="input-unit"><input data-yarn-field="weight" type="number" min="1" step="1" inputmode="decimal" value="${escapeHtml(y.weight)}" placeholder="например, 100"><b>г</b></div></label>
        </div>
        <div class="component-composition">
          <div class="composition-heading"><label>Состав · до 6 компонентов</label><span class="composition-total ${total.ok?'is-ok':'is-warn'}">Итого: ${fmt(total.sum,0)}%</span></div>
          <div class="composition-pairs">${parts.map(compositionPairHtml).join('')}</div>
          <div class="component-hint">В каждой паре укажите процент и сырьё. Сумма компонентов одной нити должна быть 100%.</div>
        </div>
      </article>`;
    }).join('');
    els.addYarnBtn.disabled=state.yarns.length>=5;
    els.addYarnBtn.textContent=state.yarns.length>=5?'Добавлено 5 нитей':'+ Добавить нить';
    updateMix();
  }

  function computeMix(){
    const active=[];const warnings=[];
    for(const [index,y] of state.yarns.entries()){
      const meters=numeric(y.meters),weight=numeric(y.weight);
      if(!meters||meters<=0||!weight||weight<=0)continue;
      const metersPer100=meters/weight*100;
      const comp=compositionForYarn(normalizeCompositionParts(y));
      if(Math.abs(comp.sum-100)>0.15)warnings.push(`Нить ${index+1}: состав сейчас ${fmt(comp.sum,0)}%, нужно 100%.`);
      active.push({...y,meters,weight,metersPer100,compositionParts:comp.parts,compositionSum:comp.sum});
    }
    if(!active.length)return null;
    const massFactor=active.reduce((sum,y)=>sum+1/y.metersPer100,0);
    if(!(massFactor>0))return null;
    const combinedMeterage=1/massFactor;
    const totals=new Map();
    for(const y of active){
      const strandMassFactor=1/y.metersPer100;
      let known=0;
      for(const p of y.compositionParts){
        known+=p.percent;
        totals.set(p.material,(totals.get(p.material)||0)+strandMassFactor*(p.percent/100));
      }
      const unknown=Math.max(0,100-known);
      if(unknown>0.05)totals.set('не указано',(totals.get('не указано')||0)+strandMassFactor*(unknown/100));
    }
    const composition=[...totals.entries()].map(([material,factor])=>({material,percent:factor/massFactor*100})).filter(x=>x.percent>.01).sort((a,b)=>b.percent-a.percent);
    return {active,combinedMeterage,totalStrands:active.length,composition,warnings};
  }

  function updateMix(){
    state.mix=computeMix();
    if(!state.mix){els.mixResult.innerHTML='<div class="mix-box"><div class="mix-top"><span>Итог рабочей нити</span><strong>Укажите метраж</strong></div></div>';return;}
    const tags=state.mix.composition.map(x=>`<span class="mix-tag">${escapeHtml(x.material)} — ${fmt(x.percent,1)}%</span>`).join('');
    els.mixResult.innerHTML=`<div class="mix-box"><div class="mix-top"><span>Итоговый метраж · ${state.mix.totalStrands} ${state.mix.totalStrands===1?'нить':'нитей'}</span><strong>≈ ${fmt(state.mix.combinedMeterage)} м/100 г</strong></div><div class="mix-composition">${tags||'<span class="mix-tag">состав не указан</span>'}</div>${state.mix.warnings.length?`<div class="mix-warning">${state.mix.warnings.map(escapeHtml).join(' ')}</div>`:''}</div>`;
    if(state.sample&&state.mix)renderSampleResult(state.sample,false);
  }

  function updateCompositionTotal(y,card){
    const badge=card?.querySelector('.composition-total');if(!badge)return;
    const t=compositionTotalState(y);badge.textContent=`Итого: ${fmt(t.sum,0)}%`;badge.classList.toggle('is-ok',t.ok);badge.classList.toggle('is-warn',!t.ok);
  }

  function readYarnInput(target){
    const card=target.closest('[data-yarn-id]');if(!card)return;
    const y=state.yarns.find(x=>x.id===Number(card.dataset.yarnId));if(!y)return;
    const field=target.dataset.yarnField;
    if(field){y[field]=target.value;updateMix();return;}
    const compIndex=Number(target.dataset.compIndex),compField=target.dataset.compField;
    if(Number.isInteger(compIndex)&&compIndex>=0&&compIndex<6&&(compField==='percent'||compField==='material')){
      const parts=normalizeCompositionParts(y);parts[compIndex][compField]=target.value;updateCompositionTotal(y,card);updateMix();
    }
  }

  function removeYarnPreservePosition(button){
    const card=button.closest('[data-yarn-id]');if(!card)return;
    const siblings=[...els.yarnComponents.querySelectorAll('[data-yarn-id]')];
    const idx=siblings.indexOf(card);const anchor=siblings[idx+1]||siblings[idx-1]||null;
    const anchorId=anchor?.dataset.yarnId||null;const anchorTop=anchor?.getBoundingClientRect().top??null;const oldY=window.scrollY;
    state.yarns=state.yarns.filter(y=>y.id!==Number(card.dataset.yarnId));renderYarns();
    requestAnimationFrame(()=>{
      const nextAnchor=anchorId?els.yarnComponents.querySelector(`[data-yarn-id="${anchorId}"]`):null;
      if(nextAnchor&&anchorTop!=null){window.scrollBy({top:nextAnchor.getBoundingClientRect().top-anchorTop,left:0,behavior:'auto'});}else{window.scrollTo({top:oldY,left:0,behavior:'auto'});}
    });
  }

  function calculateSample(){
    const stitches=numeric(els.sampleStitches.value),rows=numeric(els.sampleRows.value),width=numeric(els.sampleWidth.value),height=numeric(els.sampleHeight.value),weight=numeric(els.sampleWeight.value);
    if(!stitches||stitches<=0||!rows||rows<=0||!width||width<=0||!height||height<=0){
      els.sampleValidation.textContent='Заполните количество петель и рядов, ширину и высоту готового образца после ВТО. Вес можно не указывать.';
      return null;
    }
    els.sampleValidation.textContent='';
    const gauge=stitches/width*10,rowGauge=rows/height*10,area=width*height;
    const safeWeight=weight&&weight>0?weight:null;
    const gramsPer100cm2=safeWeight?safeWeight/area*100:null;
    const metersUsed=safeWeight&&state.mix?safeWeight/100*state.mix.combinedMeterage:null;
    state.sample={stitches,rows,width,height,weight:safeWeight,gauge,rowGauge,area,gramsPer100cm2,metersUsed};
    renderSampleResult(state.sample,true);return state.sample;
  }

  function renderSampleResult(r,shouldScroll=true){
    els.sampleResultCard.hidden=false;
    els.sampleGaugeResult.textContent=`${fmt(r.gauge,1)} п./10 см`;
    els.sampleRowsGaugeResult.textContent=`${fmt(r.rowGauge,1)} р./10 см`;
    if(r.gramsPer100cm2){
      els.areaConsumptionResult.textContent=`${fmt(r.gramsPer100cm2,2)} г/100 см²`;
      if(els.areaConsumptionHint)els.areaConsumptionHint.textContent='по готовому образцу после ВТО';
    }else{
      els.areaConsumptionResult.textContent='не рассчитан';
      if(els.areaConsumptionHint)els.areaConsumptionHint.textContent='вес образца не указан';
    }
    if(state.mix){
      els.sampleMeterageResult.textContent=`≈ ${fmt(state.mix.combinedMeterage)} м/100 г`;
      if(r.weight){
        const metersUsed=r.weight/100*state.mix.combinedMeterage;
        els.sampleMetersUsedResult.textContent=`в образце ≈ ${fmt(metersUsed,1)} м`;
      }else els.sampleMetersUsedResult.textContent='вес не указан — метры образца не считаем';
    }else{
      els.sampleMeterageResult.textContent='не рассчитан';els.sampleMetersUsedResult.textContent='заполните рабочую нить';
    }
    if(shouldScroll)els.sampleResultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function resetSampleCalculator(){
    state.yarns=[newYarn(1)];state.nextYarnId=2;state.mix=null;state.sample=null;
    [els.sampleStitches,els.sampleRows,els.sampleWidth,els.sampleHeight,els.sampleWeight].forEach(input=>{input.value='';});
    els.sampleValidation.textContent='';els.sampleResultCard.hidden=true;renderYarns();
    showToast('Расчёт сброшен');
  }

  function applySampleToProduct(){
    if(!state.sample){showToast('Сначала внесите данные готового образца и рассчитайте плотность');return false;}
    els.productGauge.value=round(state.sample.gauge,1);
    els.productRowGauge.value=round(state.sample.rowGauge,1);
    state.productGauge=state.sample.gauge;state.productRowGauge=state.sample.rowGauge;
    if(state.mix){els.productMeterage.value=Math.round(state.mix.combinedMeterage);state.productMeterage=state.mix.combinedMeterage;}
    updateGaugeHint();
    els.sampleTransferStatus.textContent=`Использована плотность готового образца после ВТО: ${fmt(state.sample.gauge,1)} п./10 см и ${fmt(state.sample.rowGauge,1)} р./10 см${state.mix?`, рабочий метраж ≈ ${fmt(state.mix.combinedMeterage)} м/100 г`:''}.`;
    switchView('product');showToast('Данные образца переданы');return true;
  }

  function renderGarments(){
    els.garmentGrid.innerHTML=D.garments.map(g=>`<button type="button" class="garment-card${g.id===state.garmentId?' is-active':''}" data-id="${g.id}">${g.child?'<span class="child-badge">дет.</span>':''}${icon(g.icon)}<span>${escapeHtml(g.name)}</span></button>`).join('');
  }

  function renderSizes(){
    const g=garment();state.sizeIndex=clamp(state.sizeIndex,0,g.sizes.length-1);
    const size=g.sizes[state.sizeIndex];
    if(g.geometry==='torso'){
      const descriptor=size.child?`рост ${size.height} см · ОГ ${size.chest} см`:`российский размер ${size.ruSize} · ОГ ${size.chest} см`;
      els.sizeHint.textContent=`${g.name}: ${descriptor}. После выбора можно уточнить размеры готового изделия в сантиметрах.`;
    }else els.sizeHint.textContent=`${g.name}: выберите размер или формат.`;
    els.sizeChips.innerHTML=g.sizes.map((s,i)=>`<button type="button" class="chip${i===state.sizeIndex?' is-active':''}" data-i="${i}">${escapeHtml(s.label)}</button>`).join('');
    renderProductDimensions(true);
  }

  function torsoDefaults(g,size){
    const chest=size.chest;
    const circ=chest+(g.ease||0);
    if(g.sex==='child'){
      const ratio=g.variant==='vest'?.36:(g.variant==='pullover'?.38:.40);
      const length=round(size.height*ratio,1);
      const sleeve=g.variant==='vest'?0:round(size.height*.33,1);
      return {bodyChest:chest,referenceHeight:size.height,circ,length,sleeve,upperArm:round(chest*.30+2,1),cuff:round(clamp(chest*.22,13,18),1),neck:round(clamp(chest*.48,24,36),1),collar:g.variant==='sweater'?6:0};
    }
    const women=g.sex==='women',ref=women?164:176;
    const baseLength=women?({pullover:60,sweater:62,cardigan:62,vest:56}[g.variant]||60):({pullover:66,sweater:68,cardigan:68,vest:62}[g.variant]||66);
    const baseSleeve=women?59:64;
    const growth=size.height||ref;
    const step=(growth-ref)/6*4;
    return {bodyChest:chest,referenceHeight:growth,circ,length:round(baseLength+step,1),sleeve:g.variant==='vest'?0:round(baseSleeve+step,1),upperArm:round(chest*.28+6,1),cuff:round((women?18:20)+(chest-(women?92:100))*.035,1),neck:round(clamp(chest*.38,31,48),1),collar:g.variant==='sweater'?(women?8:9):0};
  }

  function dimensionsFor(g,size){
    if(g.geometry==='torso')return torsoDefaults(g,size);
    if(g.geometry==='hat')return {circ:size.head,height:size.height};
    if(g.geometry==='rectangle'||g.geometry==='triangle')return {width:size.width,height:size.height};
    if(g.geometry==='socks')return {foot:size.foot,circ:size.circ,leg:size.leg};
    if(g.geometry==='mittens')return {handCirc:size.handCirc,handLength:size.handLength};
    return {};
  }

  function dimField(key,label,value,unit='см',readonly=false){
    return `<label class="field dimension-field"><span>${escapeHtml(label)}</span><div class="input-unit"><input data-dim="${key}" type="number" min="0.1" step="0.1" inputmode="decimal" value="${escapeHtml(value)}" ${readonly?'readonly':''}><b>${unit}</b></div></label>`;
  }

  function renderProductDimensions(reset=false){
    const g=garment(),size=g.sizes[state.sizeIndex];
    if(reset||!state.productDims)state.productDims=dimensionsFor(g,size);
    const d=state.productDims||{};
    let html='';
    if(g.geometry==='torso'){
      html+=dimField('bodyChest','Обхват груди по размеру',d.bodyChest,'см',true);
      html+=dimField('circ','Обхват готового изделия',d.circ);
      html+=dimField('length','Длина изделия',d.length);
      if(g.variant!=='vest'){
        html+=dimField('sleeve','Длина рукава',d.sleeve);
        html+=dimField('upperArm','Обхват рукава сверху',d.upperArm);
        html+=dimField('cuff','Обхват манжеты',d.cuff);
      }
      html+=dimField('neck','Обхват горловины',d.neck);
      if(g.variant==='sweater')html+=dimField('collar','Высота воротника',d.collar);
      const ref=size.child?`рост ${size.height} см, ОГ ${size.chest} см`:`RU ${size.ruSize}, ОГ ${size.chest} см; базовый рост ${size.height} см`;
      els.productDimensionsHint.textContent=`Основа: ${ref}. Обхват изделия уже включает стандартную прибавку модели (${g.ease||0} см). Все размеры ниже можно изменить.`;
    }else if(g.geometry==='hat'){
      html+=dimField('circ','Обхват головы',d.circ);html+=dimField('height','Полная высота шапки',d.height);
      els.productDimensionsHint.textContent='Размеры подставлены из выбранного обхвата головы. Высоту можно изменить под посадку и макушку.';
    }else if(g.geometry==='rectangle'||g.geometry==='triangle'){
      html+=dimField('width','Ширина',d.width);html+=dimField('height','Длина / высота',d.height);
      els.productDimensionsHint.textContent=g.geometry==='triangle'?'Шаль рассчитывается как треугольное полотно по ширине и высоте.':'Расчёт ведётся по фактической площади прямоугольного полотна.';
    }else if(g.geometry==='socks'){
      html+=dimField('foot','Длина стопы',d.foot);html+=dimField('circ','Обхват стопы / голени',d.circ);html+=dimField('leg','Высота паголенка',d.leg);
      els.productDimensionsHint.textContent='Для носков используется геометрическая модель пары: стопа + паголенок с поправкой на пятку и мысок.';
    }else if(g.geometry==='mittens'){
      html+=dimField('handCirc','Обхват кисти',d.handCirc);html+=dimField('handLength','Длина кисти',d.handLength);
      els.productDimensionsHint.textContent='Для пары рукавиц используется площадь кисти с поправкой на большой палец и формирование верха.';
    }
    els.productDimensionsFields.innerHTML=html;
    updateDimensionSummary();
  }

  function readProductDimensions(){
    const d={};
    els.productDimensionsFields.querySelectorAll('[data-dim]').forEach(input=>{const n=numeric(input.value);if(n!=null)d[input.dataset.dim]=n;});
    state.productDims={...(state.productDims||{}),...d};
    return state.productDims;
  }

  function garmentArea(g,d){
    if(g.geometry==='torso'){
      let area=d.circ*d.length;
      if(g.variant!=='vest')area+=2*d.sleeve*((d.upperArm+d.cuff)/2);
      if(g.variant==='sweater')area+=d.neck*d.collar*2;
      else if(g.variant==='cardigan')area+=2*d.length*4+d.neck*3;
      else if(g.variant==='vest')area+=d.neck*3+d.circ*.055*d.length;
      else area+=d.neck*2.5;
      return area;
    }
    if(g.geometry==='hat')return d.circ*d.height*.88;
    if(g.geometry==='rectangle')return d.width*d.height;
    if(g.geometry==='triangle')return d.width*d.height/2;
    if(g.geometry==='socks')return 2*d.circ*(d.leg+d.foot*.92)*.95;
    if(g.geometry==='mittens')return 2*d.handCirc*d.handLength*1.10;
    return 0;
  }

  function updateDimensionSummary(){
    if(!els.productDimensionSummary)return;
    const g=garment(),d=readProductDimensions(),area=garmentArea(g,d);
    els.productDimensionSummary.innerHTML=area>0?`<span>Расчётная площадь вязания</span><strong>≈ ${fmt(area)} см²</strong><small>до запаса 10%; используется площадь всех основных деталей</small>`:'';
  }

  function estimateMetersPer100cm2(gauge,rowGauge){
    const rg=rowGauge&&rowGauge>0?rowGauge:gauge*1.4;
    const stitchWidth=10/gauge,rowHeight=10/rg;
    const loopLengthCm=2.7*(stitchWidth+rowHeight);
    return gauge*rg*loopLengthCm/100;
  }

  function meterRangeForGauge(g){
    const keys=Object.keys(D.meterRanges).map(Number).sort((a,b)=>a-b);const v=clamp(g,keys[0],keys[keys.length-1]);const lo=Math.floor(v),hi=Math.ceil(v);const a=D.meterRanges[lo]||D.meterRanges[keys[0]],b=D.meterRanges[hi]||a;if(lo===hi)return[a[0],a[1]];const t=v-lo;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }

  function updateGaugeHint(){
    const gauge=numeric(els.productGauge.value)||20;const [a,b]=meterRangeForGauge(gauge);
    els.gaugeHint.textContent=`Ориентир для этой плотности: примерно ${fmt(a)}–${fmt(b)} м/100 г готовой рабочей нити.`;
  }

  function calculateProduct(){
    const g=garment(),size=g.sizes[state.sizeIndex],gauge=numeric(els.productGauge.value),rowGauge=numeric(els.productRowGauge.value),meterage=numeric(els.productMeterage.value);
    if(!size||!gauge||gauge<8||gauge>40||!meterage||meterage<=0){els.productValidation.textContent='Проверьте размер, плотность и рабочий метраж.';return null;}
    const dims=readProductDimensions(),area=garmentArea(g,dims);
    if(!(area>0)){els.productValidation.textContent='Проверьте размеры изделия в сантиметрах.';return null;}
    els.productValidation.textContent='';
    const range=meterRangeForGauge(clamp(gauge,8,30));
    const hasSampleWeight=!!(state.sample&&state.sample.gramsPer100cm2);
    const sampleGaugeMatches=hasSampleWeight&&Math.abs(state.sample.gauge-gauge)/gauge<=.04;
    const sampleMeterageMatches=hasSampleWeight&&state.mix&&Math.abs(state.mix.combinedMeterage-meterage)/meterage<=.04;
    let requiredMeters,rawGrams,method,metersPer100cm2;
    if(hasSampleWeight&&sampleGaugeMatches&&sampleMeterageMatches){
      rawGrams=area*(state.sample.gramsPer100cm2/100);
      requiredMeters=rawGrams/100*meterage;
      metersPer100cm2=requiredMeters/area*100;
      method='sample';
    }else{
      metersPer100cm2=estimateMetersPer100cm2(gauge,rowGauge);
      requiredMeters=area/100*metersPer100cm2;
      rawGrams=requiredMeters/meterage*100;
      method='geometry';
    }
    const reserveGrams=rawGrams*(1+D.reserve),reserveMeters=requiredMeters*(1+D.reserve);
    let compat='good';
    if(meterage<range[0]*.65||meterage>range[1]*1.4)compat='bad';else if(meterage<range[0]*.85||meterage>range[1]*1.15)compat='warn';
    state.product={garment:g,size,gauge,rowGauge,meterage,dims,area,metersPer100cm2,requiredMeters,requiredMetersWithReserve:reserveMeters,rawGrams,reserveGrams,range,compat,method};
    renderProductResult(state.product);renderMatches();return state.product;
  }

  function compatibilityCopy(r){
    const [min,max]=r.range;
    if(r.meterage>max*1.4)return ['Нить заметно тоньше','bad'];
    if(r.meterage<min*.65)return ['Нить заметно толще','bad'];
    if(r.meterage>max*1.15)return ['Нить немного тоньше','warn'];
    if(r.meterage<min*.85)return ['Нить немного толще','warn'];
    return ['Метраж подходит','good'];
  }

  function renderProductResult(r){
    els.productResultCard.hidden=false;els.productResultTitle.textContent=`${r.garment.name} · ${r.size.label}`;
    els.productResultGrams.textContent=fmt(Math.ceil(r.reserveGrams/5)*5);els.productResultMeters.textContent=`≈ ${fmt(r.requiredMetersWithReserve)} м`;els.productResultMeterage.textContent=`≈ ${fmt(r.meterage)} м/100 г`;els.productResultRawGrams.textContent=`≈ ${fmt(r.rawGrams)} г`;els.productResultReserve.textContent=`${Math.round(D.reserve*100)}%`;
    const label=compatibilityCopy(r);els.compatBadge.textContent=label[0];els.compatBadge.className='compat-badge '+label[1];
    const methodText=r.method==='sample'
      ?`Расход рассчитан по фактическому весу образца после пересчёта на площадь изделия.`
      :`Вес образца не использован: расход рассчитан геометрически по площади изделия и плотности петель/рядов (модель лицевой глади).`;
    els.productResultNote.textContent=`Площадь расчётной модели ≈ ${fmt(r.area)} см². ${methodText} В результат уже добавлен запас ${Math.round(D.reserve*100)}%. Узоры, косы, резинки, планки и декоративные детали, которых нет в образце, могут изменить расход.`;
    els.productResultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function materialText(c){return c&&c.length?c.map(x=>`${fmt(x.percent,1).replace(',0','')}% ${x.material}`).join(', '):'состав не распознан';}
  function productTitle(p){return [p.brand,p.name].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Пряжа';}
  function scoreProduct(p,target){if(!p.meterage||!Number(p.meterage.metersPer100g))return null;let best=null;for(let plies=1;plies<=12;plies++){const effective=p.meterage.metersPer100g/plies;const distance=Math.abs(Math.log(effective/target));if(!best||distance<best.distance)best={plies,effective,distance};}return best;}

  function productCard(p,match){
    const tags=[];if(p.meterage)tags.push(`${fmt(p.meterage.metersPer100g)} м/100 г`);if(p.composition?.length)tags.push(materialText(p.composition));if(p.color)tags.push(p.color);
    const visual=p.thumbUrl?`<img class="product-thumb" src="${escapeHtml(p.thumbUrl)}" alt="" loading="lazy" decoding="async">`:'<div class="yarn-swatch"></div>';
    const meta=[p.albumTitle,p.country].filter(Boolean).join(' · ')||'Каталог VK';
    const need=match.needGrams,stock=p.stockGrams==null?'не указано':`${fmt(p.stockGrams)} г`;
    return `<article class="product-card"><div class="product-card-top">${visual}<div><h3>${escapeHtml(productTitle(p))}</h3><div class="meta">${escapeHtml(meta)}</div><span class="source-badge">VK · #Калькулятор</span></div></div><div class="tag-row">${tags.slice(0,4).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}${p.stockGrams!=null?`<span class="tag good">в наличии ${fmt(p.stockGrams)} г</span>`:''}</div><div class="product-stats"><div><span>Рекомендуемое сложение</span><b>${match.plies}</b></div><div><span>Рабочий метраж</span><b>${fmt(match.effective)} м/100 г</b></div><div><span>Нужно с запасом</span><b>${fmt(need)} г</b></div><div><span>Наличие</span><b>${stock}</b></div>${p.pricePer100g?`<div><span>Ориентир цены</span><b>≈ ${fmt(need/100*p.pricePer100g)} ₽</b></div>`:''}</div>${p.photoUrl?`<button class="card-action" data-open="${encodeURIComponent(p.photoUrl)}" type="button">Открыть фото VK</button>`:''}</article>`;
  }

  function renderMatches(){
    if(!state.product){els.matchEmpty.hidden=false;els.matchContent.hidden=true;return;}
    els.matchEmpty.hidden=true;els.matchContent.hidden=false;
    const r=state.product;els.matchSummary.innerHTML=`<div class="mini-orb">${icon('yarn')}</div><div><h3>${escapeHtml(r.garment.name)} · ${escapeHtml(r.size.label)}</h3><p>Нужно ≈ ${fmt(r.requiredMetersWithReserve||r.requiredMeters)} м готовой нити с запасом. Целевой рабочий метраж: ${fmt(r.meterage)} м/100 г; ориентир для плотности — ${fmt(r.range[0])}–${fmt(r.range[1])} м/100 г.</p></div>`;
    const target=r.meterage;
    const rows=state.vkCatalog.map(p=>{const b=scoreProduct(p,target);if(!b)return null;const needRaw=(r.requiredMetersWithReserve||r.requiredMeters)/b.effective*100;const need=Math.ceil(needRaw/5)*5;const stockPenalty=p.stockGrams!=null&&p.stockGrams<need?0.35:0;return{p,b:{...b,needGrams:need},score:b.distance+stockPenalty};}).filter(Boolean).sort((a,b)=>a.score-b.score).slice(0,12);
    els.matchGrid.innerHTML=rows.length?rows.map(x=>productCard(x.p,x.b)).join(''):`<div class="empty-state"><h3>Подходящих данных пока нет</h3><p>В каталоге нет фотографий с меткой #Калькулятор и распознанным метражом либо каталог ещё не обновлён.</p></div>`;
  }

  function setCatalogStatus(text,type=''){
    els.catalogStatus.className='catalog-status'+(type?' '+type:'');els.catalogStatus.querySelector('span:last-child').textContent=text;
    els.vkState.classList.toggle('is-vk',type==='ok');
  }
  function formatSyncTime(ts){if(!ts)return'';try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));}catch(_){return'';}}

  async function loadCatalogAndSync(force=true){
    if(state.catalogStarted&&!force)return;state.catalogStarted=true;
    if(!VKCAT){setCatalogStatus('Модуль каталога не загружен.','error');return;}
    const cached=await VKCAT.loadCached();
    if(cached&&Array.isArray(cached.items)){
      state.vkCatalog=cached.items;state.vkMeta=cached;renderMatches();
      setCatalogStatus(`Кэш: ${cached.items.length} поз. с #Калькулятор${cached.syncedAt?' · '+formatSyncTime(cached.syncedAt):''}.`,'ok');
    }
    setCatalogStatus(cached?'Обновляем каталог VK в фоне…':'Загружаем каталог VK…','loading');
    els.refreshCatalogBtn.disabled=true;
    try{
      const payload=await VKCAT.sync({onProgress:x=>setCatalogStatus(x.message||'Обновляем каталог…','loading')});
      state.vkCatalog=Array.isArray(payload.items)?payload.items:[];state.vkMeta=payload;renderMatches();
      const errors=Array.isArray(payload.errors)?payload.errors.length:0;
      setCatalogStatus(`Каталог готов: ${state.vkCatalog.length} поз. с #Калькулятор${errors?' · ошибок: '+errors:''}.`,'ok');
    }catch(error){
      console.error('VK catalog sync failed:',error);
      const message=error?.error_msg||error?.message||String(error);
      setCatalogStatus(`${cached?'Используем кэш. ':''}Обновление VK не выполнено: ${message}`,'error');
    }finally{els.refreshCatalogBtn.disabled=false;}
  }

  function initVK(){
    if(!window.vkBridge)return;
    try{window.vkBridge.send('VKWebAppInit').then(()=>{els.vkState.classList.add('is-vk');}).catch(()=>{});}catch(_){ }
  }

  function copyProduct(){
    if(!state.product)return;const r=state.product;
    const text=`Мания пряжи — ориентировочный расчёт\n${r.garment.name}, ${r.size.label}\nПлотность: ${fmt(r.gauge,1)} п./10 см${r.rowGauge?`\nРяды: ${fmt(r.rowGauge,1)} р./10 см`:''}\nРабочий метраж: ${fmt(r.meterage)} м/100 г\nНужно с запасом: ≈ ${fmt(r.requiredMetersWithReserve||r.requiredMeters)} м\nВес с запасом: ≈ ${fmt(Math.ceil(r.reserveGrams/5)*5)} г`;
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>showToast('Результат скопирован')).catch(()=>fallbackCopy(text));else fallbackCopy(text);
  }
  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');showToast('Результат скопирован');}catch(_){showToast('Не удалось скопировать');}ta.remove();}

  els.consentBtn.addEventListener('click',()=>{
    els.consentScreen.hidden=true;els.app.classList.remove('is-locked');els.app.setAttribute('aria-hidden','false');
    loadCatalogAndSync(true);
  });
  $$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));
  els.addYarnBtn.addEventListener('click',()=>{if(state.yarns.length>=5)return;state.yarns.push(newYarn(state.nextYarnId++));renderYarns();});
  els.yarnComponents.addEventListener('input',e=>readYarnInput(e.target));
  els.yarnComponents.addEventListener('click',e=>{const b=e.target.closest('[data-remove-yarn]');if(!b)return;removeYarnPreservePosition(b);});
  $('#calculateSampleBtn').addEventListener('click',calculateSample);els.resetSampleBtn.addEventListener('click',resetSampleCalculator);
  els.useSampleBtn.addEventListener('click',applySampleToProduct);els.pullSampleBtn.addEventListener('click',applySampleToProduct);
  els.garmentGrid.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;state.garmentId=b.dataset.id;state.sizeIndex=Math.min(3,garment().sizes.length-1);state.productDims=null;renderGarments();renderSizes();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  els.sizeChips.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;state.sizeIndex=Number(b.dataset.i);state.productDims=null;renderSizes();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  els.productDimensionsFields.addEventListener('input',()=>{readProductDimensions();updateDimensionSummary();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  els.productGauge.addEventListener('input',updateGaugeHint);
  $('#calculateProductBtn').addEventListener('click',calculateProduct);
  $('#goMatchBtn').addEventListener('click',()=>switchView('match'));$('#copyProductBtn').addEventListener('click',copyProduct);
  els.refreshCatalogBtn.addEventListener('click',()=>loadCatalogAndSync(true));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(!b)return;const url=decodeURIComponent(b.dataset.open);window.open(url,'_blank','noopener,noreferrer');});

  renderYarns();renderGarments();renderSizes();updateGaugeHint();renderMatches();initVK();
})();
