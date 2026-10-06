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

  function blankComposition(){return [{percent:'',material:''}];}
  function newYarn(id){return {id,meters:'',weight:'',compositionParts:blankComposition()};}

  const state={
    yarns:[newYarn(1)],
    nextYarnId:2,
    mix:null,
    sample:null,
    garmentId:'women_pullover',
    sizeIndex:3,
    productGauge:null,
    productRowGauge:null,
    productMeterage:null,
    productDims:null,
    product:null,
    vkCatalog:[],
    vkMeta:null,
    catalogStarted:false,
    matchMode:'characteristics',
    matchManualMeterage:'',
    matchSearchRequested:false,
    matchFilters:{colorEnabled:false,colors:[],compositionEnabled:false,materials:{},shadeEnabled:false,shadeQuery:''}
  };

  const els={
    consentScreen:$('#consentScreen'),app:$('#app'),consentBtn:$('#consentBtn'),vkState:$('#vkState'),toast:$('#toast'),
    yarnComponents:$('#yarnComponents'),addYarnBtn:$('#addYarnBtn'),mixResult:$('#mixResult'),resetSampleBtn:$('#resetSampleBtn'),
    sampleStitches:$('#sampleStitches'),sampleRows:$('#sampleRows'),sampleWidth:$('#sampleWidth'),sampleHeight:$('#sampleHeight'),sampleWeight:$('#sampleWeight'),sampleValidation:$('#sampleValidation'),sampleResultCard:$('#sampleResultCard'),sampleGaugeResult:$('#sampleGaugeResult'),sampleRowsGaugeResult:$('#sampleRowsGaugeResult'),areaConsumptionResult:$('#areaConsumptionResult'),areaConsumptionHint:$('#areaConsumptionHint'),sampleMeterageResult:$('#sampleMeterageResult'),sampleMetersUsedResult:$('#sampleMetersUsedResult'),useSampleBtn:$('#useSampleBtn'),
    sampleTransferStatus:$('#sampleTransferStatus'),pullSampleBtn:$('#pullSampleBtn'),garmentGrid:$('#garmentGrid'),sizeChips:$('#sizeChips'),sizeHint:$('#sizeHint'),productDimensionsCard:$('#productDimensionsCard'),productDimensionsFields:$('#productDimensionsFields'),productDimensionsHint:$('#productDimensionsHint'),productDimensionSummary:$('#productDimensionSummary'),productGauge:$('#productGauge'),productRowGauge:$('#productRowGauge'),productMeterage:$('#productMeterage'),gaugeHint:$('#gaugeHint'),productValidation:$('#productValidation'),productResultCard:$('#productResultCard'),productResultTitle:$('#productResultTitle'),productResultGrams:$('#productResultGrams'),productResultMeters:$('#productResultMeters'),productResultMeterage:$('#productResultMeterage'),productResultRawGrams:$('#productResultRawGrams'),productResultReserve:$('#productResultReserve'),productResultNote:$('#productResultNote'),compatBadge:$('#compatBadge'),
    refreshCatalogBtn:$('#refreshCatalogBtn'),catalogStatus:$('#catalogStatus'),matchEmpty:$('#matchEmpty'),matchContent:$('#matchContent'),matchSummary:$('#matchSummary'),matchGrid:$('#matchGrid'),
    matchCount:$('#matchCount'),matchMeterageText:$('#matchMeterageText'),matchMeterageHint:$('#matchMeterageHint'),matchColorEnabled:$('#matchColorEnabled'),matchColorOptions:$('#matchColorOptions'),matchColorHint:$('#matchColorHint'),matchCompositionEnabled:$('#matchCompositionEnabled'),matchCompositionOptions:$('#matchCompositionOptions'),matchCompositionHint:$('#matchCompositionHint'),matchShadeEnabled:$('#matchShadeEnabled'),matchShadeSearch:$('#matchShadeSearch'),matchShadeQuery:$('#matchShadeQuery'),matchShadeSuggestions:$('#matchShadeSuggestions'),matchShadeHint:$('#matchShadeHint'),
    matchModeCharacteristics:$('#matchModeCharacteristics'),matchModeProduct:$('#matchModeProduct'),manualMatchInput:$('#manualMatchInput'),matchManualMeterage:$('#matchManualMeterage'),productMatchSource:$('#productMatchSource'),productMatchSourceText:$('#productMatchSourceText'),runMatchSearchBtn:$('#runMatchSearchBtn'),
    photoLightbox:$('#photoLightbox'),photoLightboxImage:$('#photoLightboxImage'),photoLightboxTitle:$('#photoLightboxTitle'),photoLightboxClose:$('#photoLightboxClose')
  };

  function icon(name){return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;}
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function numeric(v){const raw=String(v??'').trim().replace(',','.');if(!raw)return null;const n=Number(raw);return Number.isFinite(n)?n:null;}
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
    y.compositionParts=y.compositionParts.slice(0,6).map(x=>({percent:x?.percent??'',material:x?.material??''}));
    if(!y.compositionParts.length)y.compositionParts.push({percent:'',material:''});
    return y.compositionParts;
  }

  function compositionForYarn(parts){
    const clean=(parts||[]).map(x=>({material:String(x?.material||'').trim().toLowerCase(),percent:numeric(x?.percent)}))
      .filter(x=>x.material&&Number.isFinite(x.percent)&&x.percent>0);
    const sum=clean.reduce((a,x)=>a+x.percent,0);
    return {parts:clean,sum};
  }

  function compositionPairHtml(part,i,total){
    return `<div class="composition-pair" data-comp-row="${i}">
      <div class="percent-input"><input data-comp-index="${i}" data-comp-field="percent" type="number" min="0" max="100" step="1" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(part.percent)}" placeholder=""><span>%</span></div>
      <input class="material-input" data-comp-index="${i}" data-comp-field="material" type="text" value="${escapeHtml(part.material)}" placeholder="например, меринос">
      ${total>1?`<button class="remove-composition" type="button" data-remove-composition="${i}" aria-label="Убрать компонент">×</button>`:''}
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
          <label class="field"><span>Метраж</span><div class="input-unit"><input data-yarn-field="meters" type="number" min="1" step="1" inputmode="decimal" value="${escapeHtml(y.meters)}" placeholder="например, 1500"><b>м</b></div></label>
          <label class="field"><span>Вес</span><div class="input-unit"><input data-yarn-field="weight" type="number" min="1" step="1" inputmode="decimal" value="${escapeHtml(y.weight)}" placeholder="например, 100"><b>г</b></div></label>
        </div>
        <div class="component-composition">
          <div class="composition-heading"><label>Состав</label><span class="composition-total ${total.ok?'is-ok':'is-warn'}">Итого: ${fmt(total.sum,0)}%</span></div>
          <div class="composition-pairs">${parts.map((part,i)=>compositionPairHtml(part,i,parts.length)).join('')}</div>
          ${parts.length<6?'<button class="ghost-btn add-composition-btn" type="button" data-add-composition>+ Добавить компонент</button>':'<div class="component-limit">Добавлено максимум 6 компонентов</div>'}
          <div class="component-hint">Укажите процент и сырьё. Если в составе есть ещё компонент — добавьте его кнопкой «+». Сумма должна быть 100%.</div>
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
    if(!state.mix){
      els.mixResult.innerHTML='<div class="mix-box"><div class="mix-top"><span>Итог рабочей нити</span><strong>Укажите метраж</strong></div></div>';
      if(state.sample)renderSampleResult(state.sample,false);
      return;
    }
    const tags=state.mix.composition.map(x=>`<span class="mix-tag">${escapeHtml(x.material)} — ${fmt(x.percent,1)}%</span>`).join('');
    els.mixResult.innerHTML=`<div class="mix-box"><div class="mix-top"><span>Итоговый метраж · ${state.mix.totalStrands} ${state.mix.totalStrands===1?'нить':'нитей'}</span><strong>≈ ${fmt(state.mix.combinedMeterage)} м/100 г</strong></div><div class="mix-composition">${tags||'<span class="mix-tag">состав не указан</span>'}</div>${state.mix.warnings.length?`<div class="mix-warning">${state.mix.warnings.map(escapeHtml).join(' ')}</div>`:''}</div>`;
    if(state.sample)renderSampleResult(state.sample,false);
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
    const parts=normalizeCompositionParts(y);
    if(Number.isInteger(compIndex)&&compIndex>=0&&compIndex<parts.length&&(compField==='percent'||compField==='material')){
      parts[compIndex][compField]=target.value;updateCompositionTotal(y,card);updateMix();
    }
  }

  function rerenderYarnsKeepScroll(){
    const oldY=window.scrollY;
    renderYarns();
    requestAnimationFrame(()=>window.scrollTo({top:oldY,left:0,behavior:'auto'}));
  }

  function addComposition(button){
    const card=button.closest('[data-yarn-id]');if(!card)return;
    const y=state.yarns.find(x=>x.id===Number(card.dataset.yarnId));if(!y)return;
    const parts=normalizeCompositionParts(y);if(parts.length>=6)return;
    parts.push({percent:'',material:''});
    rerenderYarnsKeepScroll();
  }

  function removeComposition(button){
    const card=button.closest('[data-yarn-id]');if(!card)return;
    const y=state.yarns.find(x=>x.id===Number(card.dataset.yarnId));if(!y)return;
    const parts=normalizeCompositionParts(y);const index=Number(button.dataset.removeComposition);
    if(parts.length<=1||!Number.isInteger(index)||index<0||index>=parts.length)return;
    parts.splice(index,1);
    rerenderYarnsKeepScroll();
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

  function currentSampleTransferData(){
    const stitches=numeric(els.sampleStitches.value),rows=numeric(els.sampleRows.value),width=numeric(els.sampleWidth.value),height=numeric(els.sampleHeight.value);
    const gauge=stitches&&width&&stitches>0&&width>0?stitches/width*10:null;
    const rowGauge=rows&&height&&rows>0&&height>0?rows/height*10:null;
    const meterage=state.mix&&state.mix.combinedMeterage>0?state.mix.combinedMeterage:null;
    return {gauge,rowGauge,meterage};
  }

  function applySampleToProduct(){
    const source=currentSampleTransferData();
    els.productGauge.value=source.gauge?round(source.gauge,1):'';
    els.productRowGauge.value=source.rowGauge?round(source.rowGauge,1):'';
    els.productMeterage.value=source.meterage?Math.round(source.meterage):'';
    state.productGauge=source.gauge||null;state.productRowGauge=source.rowGauge||null;state.productMeterage=source.meterage||null;
    state.product=null;els.productResultCard.hidden=true;els.productValidation.textContent='';renderMatches();updateGaugeHint();
    const parts=[];
    if(source.gauge)parts.push(`${fmt(source.gauge,1)} п./10 см`);
    if(source.rowGauge)parts.push(`${fmt(source.rowGauge,1)} р./10 см`);
    if(source.meterage)parts.push(`${fmt(source.meterage)} м/100 г`);
    els.sampleTransferStatus.textContent=parts.length?`Из первого этапа перенесено: ${parts.join(', ')}.`:'В первом этапе нет заполненных данных — поля оставлены пустыми.';
    switchView('product');showToast(parts.length?'Данные образца переданы':'Поля образца очищены');return true;
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
    els.productDimensionSummary.innerHTML=area>0?`<span>Расчётная площадь вязания</span><strong>≈ ${fmt(area)} см²</strong><small>Расчётная площадь указана БЕЗ запаса. Используется площадь ТОЛЬКО основных деталей.</small>`:'';
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

  function inferGaugeFromMeterage(meterage){
    const entries=Object.entries(D.meterRanges).map(([g,r])=>({g:Number(g),mid:(r[0]+r[1])/2}));
    let best=entries[0];
    for(const item of entries){
      const d=Math.abs(Math.log(item.mid/meterage));
      const bd=Math.abs(Math.log(best.mid/meterage));
      if(d<bd)best=item;
    }
    return best.g;
  }

  function updateGaugeHint(){
    const gauge=numeric(els.productGauge.value),rowGauge=numeric(els.productRowGauge.value),meterage=numeric(els.productMeterage.value);
    if(gauge&&gauge>0){
      const [a,b]=meterRangeForGauge(clamp(gauge,8,30));
      els.gaugeHint.textContent=`Для ${fmt(gauge,1)} п./10 см ориентир по рабочему метражу: примерно ${fmt(a)}–${fmt(b)} м/100 г.`;
      return;
    }
    if(rowGauge&&rowGauge>0){
      els.gaugeHint.textContent='Петли можно не указывать. При расчёте будет использована указанная плотность по рядам и расчётная плотность по петлям.';
      return;
    }
    if(meterage&&meterage>0){
      const inferred=inferGaugeFromMeterage(meterage);
      els.gaugeHint.textContent=`Плотность не указана — допустимо. Для ориентировочного расчёта будет использована типичная плотность около ${fmt(inferred,1)} п./10 см для такого метража.`;
      return;
    }
    els.gaugeHint.textContent='Петли и ряды необязательны. Если их не указывать, расчёт будет выполнен по размерам изделия и типичной плотности для введённого метража, поэтому точность будет ниже.';
  }

  function calculateProduct(){
    const g=garment(),size=g.sizes[state.sizeIndex],gauge=numeric(els.productGauge.value),rowGauge=numeric(els.productRowGauge.value),meterage=numeric(els.productMeterage.value);
    if(!size||!meterage||meterage<=0){els.productValidation.textContent='Проверьте размер и укажите рабочий метраж.';return null;}
    if(gauge!=null&&(gauge<8||gauge>40)){els.productValidation.textContent='Плотность по петлям должна быть в пределах 8–40 п./10 см либо оставьте поле пустым.';return null;}
    if(rowGauge!=null&&rowGauge<=0){els.productValidation.textContent='Плотность по рядам должна быть больше нуля либо оставьте поле пустым.';return null;}
    const dims=readProductDimensions(),area=garmentArea(g,dims);
    if(!(area>0)){els.productValidation.textContent='Проверьте размеры изделия в сантиметрах.';return null;}
    els.productValidation.textContent='';
    const calcGauge=gauge||(rowGauge?clamp(rowGauge/1.4,8,30):inferGaugeFromMeterage(meterage));
    const calcRowGauge=rowGauge||(gauge?gauge*1.4:calcGauge*1.4);
    const range=meterRangeForGauge(clamp(calcGauge,8,30));
    const hasSampleWeight=!!(state.sample&&state.sample.gramsPer100cm2);
    const sampleGaugeMatches=hasSampleWeight&&(!gauge||Math.abs(state.sample.gauge-gauge)/gauge<=.04);
    const sampleMeterageMatches=hasSampleWeight&&state.mix&&Math.abs(state.mix.combinedMeterage-meterage)/meterage<=.04;
    let requiredMeters,rawGrams,method,metersPer100cm2;
    if(hasSampleWeight&&sampleGaugeMatches&&sampleMeterageMatches){
      rawGrams=area*(state.sample.gramsPer100cm2/100);
      requiredMeters=rawGrams/100*meterage;
      metersPer100cm2=requiredMeters/area*100;
      method='sample';
    }else{
      metersPer100cm2=estimateMetersPer100cm2(calcGauge,calcRowGauge);
      requiredMeters=area/100*metersPer100cm2;
      rawGrams=requiredMeters/meterage*100;
      method=gauge?'geometry':(rowGauge?'geometry_rows':'geometry_inferred');
    }
    const reserveGrams=rawGrams*(1+D.reserve),reserveMeters=requiredMeters*(1+D.reserve);
    let compat='good';
    if(!gauge)compat='warn';
    else if(meterage<range[0]*.65||meterage>range[1]*1.4)compat='bad';else if(meterage<range[0]*.85||meterage>range[1]*1.15)compat='warn';
    state.product={garment:g,size,gauge,rowGauge,calcGauge,calcRowGauge,meterage,dims,area,metersPer100cm2,requiredMeters,requiredMetersWithReserve:reserveMeters,rawGrams,reserveGrams,range,compat,method};
    renderProductResult(state.product);renderMatches();return state.product;
  }

  function compatibilityCopy(r){
    if(!r.gauge)return ['Расчёт без указанной плотности','warn'];
    const [min,max]=r.range;
    if(r.meterage>max*1.4)return ['Рабочая нить заметно тоньше, чем обычно для этой плотности','bad'];
    if(r.meterage<min*.65)return ['Рабочая нить заметно толще, чем обычно для этой плотности','bad'];
    if(r.meterage>max*1.15)return ['Рабочая нить немного тоньше, чем обычно для этой плотности','warn'];
    if(r.meterage<min*.85)return ['Рабочая нить немного толще, чем обычно для этой плотности','warn'];
    return ['Рабочий метраж соответствует указанной плотности','good'];
  }

  function renderProductResult(r){
    els.productResultCard.hidden=false;els.productResultTitle.textContent=`${r.garment.name} · ${r.size.label}`;
    els.productResultGrams.textContent=fmt(Math.ceil(r.reserveGrams/5)*5);els.productResultMeters.textContent=`≈ ${fmt(r.requiredMetersWithReserve)} м`;els.productResultMeterage.textContent=`≈ ${fmt(r.meterage)} м/100 г`;els.productResultRawGrams.textContent=`≈ ${fmt(r.rawGrams)} г`;els.productResultReserve.textContent=`${Math.round(D.reserve*100)}%`;
    const label=compatibilityCopy(r);els.compatBadge.textContent=label[0];els.compatBadge.className='compat-badge '+label[1];
    const methodText=r.method==='sample'
      ?`Расход рассчитан по фактическому весу образца после пересчёта на площадь изделия.`
      :r.method==='geometry'
        ?`Вес образца не использован: расход рассчитан геометрически по площади изделия и указанной плотности петель/рядов.`
        :r.method==='geometry_rows'
          ?`Плотность по петлям не указана: расход рассчитан по площади изделия, указанной плотности рядов и расчётной плотности петель.`
          :`Плотность не указана: расход рассчитан по площади изделия и типичной плотности, соответствующей введённому метражу. Это менее точный режим.`;
    const meterageContext=r.gauge
      ?` При плотности ${fmt(r.gauge,1)} п./10 см ориентировочный диапазон рабочего метража составляет примерно ${fmt(r.range[0])}–${fmt(r.range[1])} м/100 г. Указано: ${fmt(r.meterage)} м/100 г.`
      :'';
    els.productResultNote.textContent=`Площадь расчётной модели ≈ ${fmt(r.area)} см². ${methodText}${meterageContext} В результат уже добавлен запас ${Math.round(D.reserve*100)}%. Узоры, косы, резинки, планки и декоративные детали, которых нет в образце, могут изменить расход.`;
    els.productResultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function materialText(c){return c&&c.length?c.map(x=>`${fmt(x.percent,1).replace(',0','')}% ${x.material}`).join(', '):'состав не указан';}
  function productTitle(p){return [p.brand,p.name].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Пряжа';}
  function normalizeFilterText(v){return String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');}
  function titleCase(v){const s=String(v||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
  function matchTolerance(){return Number(window.MANIA_CONFIG?.MATCH_TOLERANCE||0.10);}
  function maxMatchPlies(){return Math.max(1,Number(window.MANIA_CONFIG?.MAX_MATCH_PLIES||6));}

  function scoreProduct(p,target){
    if(!p.meterage||!Number(p.meterage.metersPer100g)||!target)return null;
    const raw=Number(p.meterage.metersPer100g),tol=matchTolerance();let best=null;
    for(let plies=1;plies<=maxMatchPlies();plies++){
      const effective=raw/plies;
      const deviation=(effective-target)/target;
      const absDeviation=Math.abs(deviation);
      if(absDeviation>tol+1e-9)continue;
      if(!best||absDeviation<best.absDeviation)best={plies,effective,deviation,absDeviation};
    }
    return best;
  }

  function catalogColors(){
    const map=new Map();
    for(const p of state.vkCatalog){
      const raw=String(p?.color||'').trim();if(!raw)continue;
      const key=normalizeFilterText(raw);if(!map.has(key))map.set(key,raw);
    }
    return [...map.entries()].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label,'ru'));
  }

  function catalogMaterials(){
    const map=new Map();
    for(const p of state.vkCatalog){
      for(const part of (Array.isArray(p?.composition)?p.composition:[])){
        const raw=String(part?.material||'').trim();if(!raw)continue;
        const key=normalizeFilterText(raw);if(!map.has(key))map.set(key,raw);
      }
    }
    return [...map.entries()].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label,'ru'));
  }

  function catalogShades(){
    const map=new Map();
    for(const p of state.vkCatalog){
      const raw=String(p?.shade||'').trim();if(!raw)continue;
      const key=normalizeFilterText(raw);if(!map.has(key))map.set(key,raw);
    }
    return [...map.entries()].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label,'ru'));
  }

  function matchingShadeSuggestions(query){
    const q=normalizeFilterText(query);if(!q)return catalogShades().slice(0,6);
    return catalogShades().filter(x=>x.key.includes(q)).sort((a,b)=>{
      const ap=a.key.startsWith(q)?0:1,bp=b.key.startsWith(q)?0:1;
      return ap-bp||a.label.localeCompare(b.label,'ru');
    }).slice(0,6);
  }

  function shadeMatchStats(query){
    const q=normalizeFilterText(query);
    if(!q)return {shadeCount:0,productCount:0};
    const shades=new Set();let productCount=0;
    for(const p of state.vkCatalog){
      const raw=String(p?.shade||'').trim();if(!raw)continue;
      const key=normalizeFilterText(raw);if(!key.includes(q))continue;
      shades.add(key);productCount++;
    }
    return {shadeCount:shades.size,productCount};
  }

  function renderShadeSuggestions(){
    if(!els.matchShadeSuggestions)return;
    if(!state.matchFilters.shadeEnabled){els.matchShadeSuggestions.hidden=true;els.matchShadeSuggestions.innerHTML='';return;}
    const rawQuery=String(state.matchFilters.shadeQuery||'').trim();
    const items=matchingShadeSuggestions(rawQuery);
    if(!rawQuery){
      els.matchShadeSuggestions.innerHTML='<div class="shade-suggestion-empty">Введите часть оттенка, например «синий». Будут найдены все оттенки, содержащие это слово.</div>';
      els.matchShadeSuggestions.hidden=false;return;
    }
    const stats=shadeMatchStats(rawQuery);
    if(!stats.productCount){els.matchShadeSuggestions.innerHTML='<div class="shade-suggestion-empty">Совпадений в каталоге нет</div>';els.matchShadeSuggestions.hidden=false;return;}
    const summary=`<button type="button" class="shade-match-all" data-match-shade-all role="option"><strong>Все оттенки с «${escapeHtml(rawQuery)}»</strong><span>${stats.shadeCount} ${stats.shadeCount===1?'вариант':'вариантов'} · ${stats.productCount} ${stats.productCount===1?'товар':'товаров'}</span></button>`;
    const examples=items.length?`<div class="shade-suggestion-caption">Уточнить до конкретного оттенка:</div>${items.map(x=>`<button type="button" class="shade-suggestion" data-match-shade="${encodeURIComponent(x.label)}" role="option">${escapeHtml(x.label)}</button>`).join('')}`:'';
    els.matchShadeSuggestions.innerHTML=summary+examples;
    els.matchShadeSuggestions.hidden=false;
  }

  function renderMatchFilterOptions(){
    const colors=catalogColors();
    const colorKeys=new Set(colors.map(x=>x.key));
    state.matchFilters.colors=state.matchFilters.colors.filter(x=>colorKeys.has(x));
    els.matchColorEnabled.checked=state.matchFilters.colorEnabled;
    els.matchColorOptions.hidden=!state.matchFilters.colorEnabled;
    els.matchColorHint.hidden=state.matchFilters.colorEnabled&&colors.length>0;
    if(!colors.length){
      els.matchColorOptions.innerHTML='<div class="filter-empty">Нет доступных цветов.</div>';
      els.matchColorHint.hidden=false;
    }else{
      els.matchColorOptions.innerHTML=colors.map(x=>`<label class="filter-chip"><input type="checkbox" data-match-color="${escapeHtml(x.key)}" ${state.matchFilters.colors.includes(x.key)?'checked':''}><span>${escapeHtml(x.label)}</span></label>`).join('');
    }

    const materials=catalogMaterials();
    const materialKeys=new Set(materials.map(x=>x.key));
    Object.keys(state.matchFilters.materials).forEach(k=>{if(!materialKeys.has(k))delete state.matchFilters.materials[k];});
    els.matchCompositionEnabled.checked=state.matchFilters.compositionEnabled;
    els.matchCompositionOptions.hidden=!state.matchFilters.compositionEnabled;
    els.matchCompositionHint.hidden=state.matchFilters.compositionEnabled&&materials.length>0;
    if(!materials.length){
      els.matchCompositionOptions.innerHTML='<div class="filter-empty">Нет доступных вариантов состава.</div>';
      els.matchCompositionHint.hidden=false;
    }else{
      els.matchCompositionOptions.innerHTML=materials.map(x=>{
        const selected=Object.prototype.hasOwnProperty.call(state.matchFilters.materials,x.key);
        const min=selected?state.matchFilters.materials[x.key]:'';
        return `<div class="composition-filter-item">
          <label><input type="checkbox" data-match-material="${escapeHtml(x.key)}" ${selected?'checked':''}><span>${escapeHtml(titleCase(x.label))}</span></label>
          <div class="composition-min${selected?'':' is-disabled'}"><span>не менее</span><div class="percent-filter"><input data-match-material-min="${escapeHtml(x.key)}" type="number" min="0" max="100" step="1" inputmode="numeric" value="${escapeHtml(min)}" ${selected?'':'disabled'} placeholder="0"><b>%</b></div></div>
        </div>`;
      }).join('');
    }

    els.matchShadeEnabled.checked=state.matchFilters.shadeEnabled;
    els.matchShadeSearch.hidden=!state.matchFilters.shadeEnabled;
    if(els.matchShadeQuery.value!==state.matchFilters.shadeQuery)els.matchShadeQuery.value=state.matchFilters.shadeQuery;
    els.matchShadeHint.textContent=catalogShades().length?'Введите часть названия оттенка. Подсказки формируются из каталога.':'В каталоге пока нет заполненных оттенков.';
  }

  function productPassesColor(p){
    if(!state.matchFilters.colorEnabled)return true;
    if(!state.matchFilters.colors.length)return true;
    return state.matchFilters.colors.includes(normalizeFilterText(p.color));
  }

  function productPassesComposition(p){
    if(!state.matchFilters.compositionEnabled)return true;
    const wanted=Object.entries(state.matchFilters.materials);
    if(!wanted.length)return true;
    const actual=new Map((Array.isArray(p.composition)?p.composition:[]).map(x=>[normalizeFilterText(x.material),Number(x.percent)||0]));
    return wanted.every(([key,minRaw])=>{
      if(!actual.has(key))return false;
      const min=Number(minRaw);return !Number.isFinite(min)||min<=0||actual.get(key)>=min;
    });
  }

  function productPassesShade(p){
    if(!state.matchFilters.shadeEnabled)return true;
    const q=normalizeFilterText(state.matchFilters.shadeQuery);if(!q)return true;
    return normalizeFilterText(p?.shade).includes(q);
  }

  function productCard(p,match){
    const tags=[];
    if(p.meterage)tags.push(`${fmt(p.meterage.metersPer100g)} м/100 г`);
    if(p.composition?.length)tags.push(materialText(p.composition));
    if(p.color)tags.push(`Цвет: ${p.color}`);
    if(p.shade)tags.push(`Оттенок: ${p.shade}`);
    const fullImage=p.fullImageUrl||p.thumbUrl||'';
    const visual=p.thumbUrl?`<button class="product-thumb-button" type="button" data-image-src="${encodeURIComponent(fullImage)}" data-image-fallback="${encodeURIComponent(p.thumbUrl)}" data-image-title="${encodeURIComponent(productTitle(p))}" aria-label="Увеличить фото: ${escapeHtml(productTitle(p))}"><img class="product-thumb" src="${escapeHtml(p.thumbUrl)}" alt="${escapeHtml(productTitle(p))}" loading="lazy" decoding="async"></button>`:'<div class="yarn-swatch"></div>';
    const meta=[p.country].filter(Boolean).join(' · ');
    const hasNeed=Number.isFinite(match.needGrams)&&match.needGrams>0;
    const need=hasNeed?match.needGrams:null;
    const stock=p.stockGrams;
    const stockBobbins=Array.isArray(p.stockBobbinsGrams)?p.stockBobbinsGrams.filter(x=>Number.isFinite(Number(x))&&Number(x)>0).map(Number):[];
    const stockBreakdown=stockBobbins.length>1?`<small class="stock-bobbins">${stockBobbins.map(x=>fmt(x)).join(' + ')} г</small>`:'';
    let stockHtml='';
    let statsHtml='';
    if(hasNeed){
      let stockState='<div class="stock-state neutral"><span>Количество</span><b>не указано</b></div>';
      if(stock!=null){
        const delta=stock-need;
        stockState=delta>=0
          ?`<div class="stock-state enough"><span>Пряжи хватает</span><b>Останется ≈ ${fmt(delta)} г</b></div>`
          :`<div class="stock-state shortage"><span>Пряжи не хватает</span><b>Не хватает ≈ ${fmt(Math.abs(delta))} г</b></div>`;
      }
      statsHtml=`<div class="product-stats"><div><span>Нужно с запасом</span><b>≈ ${fmt(need)} г</b></div><div><span>В наличии</span><b>${stock==null?'—':`${fmt(stock)} г`}</b>${stock==null?'':stockBreakdown}</div>${p.pricePer100g?`<div><span>Ориентировочная стоимость</span><b>≈ ${fmt(need/100*p.pricePer100g)} ₽</b></div>`:''}</div>`;
      stockHtml=stockState;
    }else{
      statsHtml=`<div class="product-stats characteristic-stats">${stock!=null?`<div><span>В наличии</span><b>${fmt(stock)} г</b>${stockBreakdown}</div>`:''}${p.pricePer100g?`<div><span>Цена</span><b>${fmt(p.pricePer100g)} ₽ / 100 г</b></div>`:''}</div>`;
    }
    let meterageHtml='';
    if(match.meterageMatched&&p.meterage){
      const deviationPct=match.deviation*100;
      const deviationText=Math.abs(deviationPct)<0.05?'точное совпадение':`${deviationPct>0?'+':''}${fmt(deviationPct,1)}% от цели`;
      const plyWord=match.plies===1?'1 нить':`${match.plies} нити`;
      meterageHtml=`<div class="meterage-match"><div><span>Исходный метраж</span><b>${fmt(p.meterage.metersPer100g)} м/100 г</b></div><div class="match-arrow">→</div><div><span>${escapeHtml(plyWord)}</span><b>≈ ${fmt(match.effective)} м/100 г</b><small>${escapeHtml(deviationText)}</small></div></div>`;
    }
    return `<article class="product-card">
      <div class="product-card-top">${visual}<div><h3>${escapeHtml(productTitle(p))}</h3>${meta?`<div class="meta">${escapeHtml(meta)}</div>`:''}</div></div>
      <div class="tag-row">${tags.slice(0,5).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      ${meterageHtml}
      ${statsHtml}
      ${stockHtml}
      ${p.photoUrl?`<button class="card-action" data-open="${encodeURIComponent(p.photoUrl)}" type="button">Открыть фото VK</button>`:''}
    </article>`;
  }

  function hasSelectedColor(){return state.matchFilters.colorEnabled&&state.matchFilters.colors.length>0;}
  function hasSelectedComposition(){return state.matchFilters.compositionEnabled&&Object.keys(state.matchFilters.materials).length>0;}
  function hasSelectedShade(){return state.matchFilters.shadeEnabled&&normalizeFilterText(state.matchFilters.shadeQuery).length>0;}

  function matchContext(){
    if(state.matchMode==='product'){
      if(!state.product)return null;
      const r=state.product;
      return {mode:'product',target:r.meterage,requiredMeters:r.requiredMetersWithReserve||r.requiredMeters,product:r,hasMeterage:true};
    }
    const rawTarget=numeric(els.matchManualMeterage.value);
    const target=rawTarget&&rawTarget>0?rawTarget:null;
    const hasColor=hasSelectedColor();
    const hasComposition=hasSelectedComposition();
    const hasShade=hasSelectedShade();
    if(!target&&!hasColor&&!hasComposition&&!hasShade)return null;
    return {mode:'characteristics',target,hasMeterage:!!target,hasColor,hasComposition,hasShade};
  }

  function renderMatchMode(){
    const isProduct=state.matchMode==='product';
    els.matchModeCharacteristics.classList.toggle('is-active',!isProduct);
    els.matchModeProduct.classList.toggle('is-active',isProduct);
    els.manualMatchInput.hidden=isProduct;
    els.productMatchSource.hidden=!isProduct;
    if(isProduct){
      if(state.product){
        const r=state.product;
        els.productMatchSourceText.innerHTML=`Используем расчёт: <b>${escapeHtml(r.garment.name)} · ${escapeHtml(r.size.label)}</b>, ${fmt(r.meterage)} м/100 г, требуется ≈ ${fmt(Math.ceil(r.reserveGrams/5)*5)} г.`;
      }else{
        els.productMatchSourceText.textContent='Сначала рассчитайте изделие во второй вкладке.';
      }
    }
  }

  function setMatchPrompt(title,text){
    els.matchEmpty.hidden=false;els.matchContent.hidden=true;
    els.matchEmpty.querySelector('h3').textContent=title;
    els.matchEmpty.querySelector('p').textContent=text;
  }

  function renderMatches(){
    renderMatchMode();
    renderMatchFilterOptions();
    const tolPct=Math.round(matchTolerance()*100);
    const ctx=matchContext();
    const manualTarget=numeric(els.matchManualMeterage.value);
    if(state.matchMode==='product'){
      if(state.product){
        els.matchMeterageText.textContent=`${fmt(state.product.meterage)} м/100 г · допуск ±${tolPct}%`;
        els.matchMeterageHint.textContent=`Проверяем 1–${maxMatchPlies()} сложений одной и той же пряжи.`;
      }else{
        els.matchMeterageText.textContent='Нет расчёта изделия';
        els.matchMeterageHint.textContent='Сначала рассчитайте изделие или выберите режим «По характеристикам».';
      }
    }else if(manualTarget&&manualTarget>0){
      els.matchMeterageText.textContent=`${fmt(manualTarget)} м/100 г · допуск ±${tolPct}%`;
      els.matchMeterageHint.textContent=`Проверяем 1–${maxMatchPlies()} сложений одной и той же пряжи.`;
    }else{
      els.matchMeterageText.textContent='Метраж не используется';
      els.matchMeterageHint.textContent='Оставьте поле пустым, если метраж не важен.';
    }

    if(!state.matchSearchRequested){
      els.matchCount.textContent='—';
      if(state.matchMode==='product'&&!state.product){
        setMatchPrompt('Сначала рассчитайте изделие','Либо переключитесь на «По характеристикам» и задайте один или несколько параметров вручную.');
      }else if(ctx){
        setMatchPrompt('Условия готовы','Нажмите «Найти», чтобы показать подходящую пряжу.');
      }else{
        setMatchPrompt('Задайте условия поиска','Можно искать по метражу, цвету, составу, оттенку или их сочетанию. Затем нажмите «Найти».');
      }
      return;
    }

    if(!ctx){
      els.matchCount.textContent='0 вариантов';
      if(state.matchMode==='product')setMatchPrompt('Сначала рассчитайте изделие','Либо переключитесь на «По характеристикам».');
      else setMatchPrompt('Выберите хотя бы одно условие','Укажите метраж, выберите цвет, состав, оттенок или несколько условий одновременно.');
      return;
    }

    els.matchEmpty.hidden=true;els.matchContent.hidden=false;
    if(ctx.mode==='product'){
      const r=ctx.product;
      const densityText=r.gauge?`плотность ${fmt(r.gauge,1)} п./10 см`:`плотность не указана`;
      els.matchSummary.innerHTML=`<div class="mini-orb">${icon('yarn')}</div><div><h3>${escapeHtml(r.garment.name)} · ${escapeHtml(r.size.label)}</h3><p>Нужно ≈ ${fmt(ctx.requiredMeters)} м готовой нити с запасом. Целевой метраж: <b>${fmt(ctx.target)} м/100 г</b>; ${densityText}.</p></div>`;
    }else{
      const bits=[];
      if(ctx.target)bits.push(`метраж ${fmt(ctx.target)} м/100 г`);
      if(ctx.hasColor)bits.push('выбранный цвет');
      if(ctx.hasComposition)bits.push('выбранный состав');
      if(ctx.hasShade)bits.push(`оттенок «${state.matchFilters.shadeQuery.trim()}»`);
      els.matchSummary.innerHTML=`<div class="mini-orb">${icon('yarn')}</div><div><h3>Подбор по характеристикам</h3><p>Учитываем: ${escapeHtml(bits.join(' · '))}.</p></div>`;
    }

    const rows=state.vkCatalog.map(p=>{
      let b;
      if(ctx.hasMeterage){
        b=scoreProduct(p,ctx.target);if(!b)return null;
        b={...b,meterageMatched:true};
      }else{
        b={plies:1,effective:p.meterage?Number(p.meterage.metersPer100g):null,deviation:null,absDeviation:Number.POSITIVE_INFINITY,meterageMatched:false};
      }
      if(!productPassesColor(p)||!productPassesComposition(p)||!productPassesShade(p))return null;
      if(ctx.mode==='product'){
        const needRaw=ctx.requiredMeters/b.effective*100;
        const need=Math.ceil(needRaw/5)*5;
        const stockEnough=p.stockGrams==null?null:p.stockGrams>=need;
        return{p,b:{...b,needGrams:need,stockEnough}};
      }
      return{p,b:{...b,needGrams:null,stockEnough:null}};
    }).filter(Boolean).sort((a,b)=>{
      if(ctx.hasMeterage){const d=a.b.absDeviation-b.b.absDeviation;if(Math.abs(d)>1e-9)return d;}
      if(ctx.mode==='product'){
        if(a.b.stockEnough!==b.b.stockEnough){if(a.b.stockEnough===true)return-1;if(b.b.stockEnough===true)return 1;}
      }
      return productTitle(a.p).localeCompare(productTitle(b.p),'ru');
    });

    els.matchCount.textContent=`${rows.length} ${rows.length%10===1&&rows.length%100!==11?'вариант':([2,3,4].includes(rows.length%10)&&![12,13,14].includes(rows.length%100)?'варианта':'вариантов')}`;
    els.matchGrid.innerHTML=rows.length?rows.map(x=>productCard(x.p,x.b)).join(''):`<div class="empty-state match-no-results"><h3>По выбранным условиям ничего не найдено</h3><p>Попробуйте изменить или отключить один из фильтров${ctx.hasMeterage?`. Для метража используется допуск ±${tolPct}% и учитывается сложение одной и той же пряжи.`:'.'}</p></div>`;
  }

  let photoLightboxPreviousFocus=null;
  let photoLightboxSwipe=null;
  function setNativeSwipeBackForPhoto(blocked){
    const bridge=window.vkBridge;
    if(!bridge||typeof bridge.send!=='function')return;
    const standardMethod=()=>bridge.send('VKWebAppSetSwipeSettings',{history:!blocked});
    const fallbackMethod=()=>bridge.send(blocked?'VKWebAppDisableSwipeBack':'VKWebAppEnableSwipeBack',{});
    try{
      const request=standardMethod();
      if(request&&typeof request.catch==='function')request.catch(()=>{try{const fallback=fallbackMethod();if(fallback&&typeof fallback.catch==='function')fallback.catch(()=>{});}catch(_){}});
    }catch(_){try{const fallback=fallbackMethod();if(fallback&&typeof fallback.catch==='function')fallback.catch(()=>{});}catch(__){}}
  }
  async function openPhotoLightbox(src,fallback,title){
    if(!src)return;

    // В мобильных клиентах VK используем нативный просмотрщик изображений.
    // Он сам обрабатывает системный жест/кнопку «назад»: сначала закрывает фото,
    // не отдавая этот жест на выход из Mini App.
    const bridge=window.vkBridge;
    if(bridge&&typeof bridge.send==='function'){
      try{
        await bridge.send('VKWebAppShowImages',{images:[src],start_index:0});
        return;
      }catch(error){
        // Если полноразмерный URL по какой-либо причине не открылся, пробуем миниатюру.
        if(fallback&&fallback!==src){
          try{
            await bridge.send('VKWebAppShowImages',{images:[fallback],start_index:0});
            return;
          }catch(_){}
        }
      }
    }

    // Запасной просмотрщик для обычного браузера/неподдерживаемой платформы.
    if(!els.photoLightbox||!els.photoLightboxImage)return;
    photoLightboxPreviousFocus=document.activeElement;
    photoLightboxSwipe=null;
    els.photoLightboxImage.dataset.fallback=fallback||'';
    els.photoLightboxImage.src=src;
    els.photoLightboxImage.alt=title||'Фото пряжи';
    els.photoLightboxTitle.textContent=title||'Фото пряжи';
    els.photoLightbox.hidden=false;
    document.body.classList.add('photo-lightbox-open');
    setNativeSwipeBackForPhoto(true);
    requestAnimationFrame(()=>els.photoLightboxClose?.focus());
  }
  function closePhotoLightbox(){
    if(!els.photoLightbox||els.photoLightbox.hidden)return;
    photoLightboxSwipe=null;
    els.photoLightbox.hidden=true;
    document.body.classList.remove('photo-lightbox-open');
    els.photoLightboxImage.removeAttribute('src');
    els.photoLightboxImage.dataset.fallback='';
    setNativeSwipeBackForPhoto(false);
    if(photoLightboxPreviousFocus&&typeof photoLightboxPreviousFocus.focus==='function')photoLightboxPreviousFocus.focus();
    photoLightboxPreviousFocus=null;
  }
  function startPhotoSwipe(e){
    if(!els.photoLightbox||els.photoLightbox.hidden||e.pointerType==='mouse')return;
    photoLightboxSwipe={id:e.pointerId,x:e.clientX,y:e.clientY};
    try{els.photoLightbox.setPointerCapture?.(e.pointerId);}catch(_){}
  }
  function endPhotoSwipe(e){
    if(!photoLightboxSwipe||photoLightboxSwipe.id!==e.pointerId)return;
    const dx=e.clientX-photoLightboxSwipe.x,dy=e.clientY-photoLightboxSwipe.y;
    const distance=Math.hypot(dx,dy);
    photoLightboxSwipe=null;
    if(distance>=52){e.preventDefault();closePhotoLightbox();}
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
      setCatalogStatus(`Каталог готов${cached.syncedAt?' · обновлён '+formatSyncTime(cached.syncedAt):''}.`,'ok');
    }
    setCatalogStatus(cached?'Обновляем каталог…':'Загружаем каталог…','loading');
    els.refreshCatalogBtn.disabled=true;
    try{
      const payload=await VKCAT.sync({onProgress:()=>setCatalogStatus('Обновляем каталог…','loading')});
      state.vkCatalog=Array.isArray(payload.items)?payload.items:[];state.vkMeta=payload;renderMatches();
      const errors=Array.isArray(payload.errors)?payload.errors.length:0;
      setCatalogStatus(errors?'Каталог обновлён частично.':'Каталог готов.','ok');
    }catch(error){
      console.error('VK catalog sync failed:',error);
      setCatalogStatus(cached?'Не удалось обновить каталог. Используется сохранённая версия.':'Не удалось загрузить каталог.','error');
    }finally{els.refreshCatalogBtn.disabled=false;}
  }

  function initVK(){
    if(!window.vkBridge)return;
    try{window.vkBridge.send('VKWebAppInit').then(()=>{els.vkState.classList.add('is-vk');}).catch(()=>{});}catch(_){ }
  }

  function copyProduct(){
    if(!state.product)return;const r=state.product;
    const densityLine=r.gauge?`Плотность: ${fmt(r.gauge,1)} п./10 см`:`Плотность: не указана (расчётный ориентир ≈ ${fmt(r.calcGauge,1)} п./10 см)`;
    const text=`Мания пряжи — ориентировочный расчёт\n${r.garment.name}, ${r.size.label}\n${densityLine}${r.rowGauge?`\nРяды: ${fmt(r.rowGauge,1)} р./10 см`:''}\nРабочий метраж: ${fmt(r.meterage)} м/100 г\nНужно с запасом: ≈ ${fmt(r.requiredMetersWithReserve||r.requiredMeters)} м\nВес с запасом: ≈ ${fmt(Math.ceil(r.reserveGrams/5)*5)} г`;
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
  els.yarnComponents.addEventListener('click',e=>{
    const add=e.target.closest('[data-add-composition]');if(add){addComposition(add);return;}
    const removeComp=e.target.closest('[data-remove-composition]');if(removeComp){removeComposition(removeComp);return;}
    const removeYarn=e.target.closest('[data-remove-yarn]');if(removeYarn)removeYarnPreservePosition(removeYarn);
  });
  $('#calculateSampleBtn').addEventListener('click',calculateSample);els.resetSampleBtn.addEventListener('click',resetSampleCalculator);
  [els.sampleStitches,els.sampleRows,els.sampleWidth,els.sampleHeight,els.sampleWeight].forEach(input=>input.addEventListener('input',()=>{
    state.sample=null;els.sampleResultCard.hidden=true;els.sampleValidation.textContent='';
  }));
  els.useSampleBtn.addEventListener('click',applySampleToProduct);els.pullSampleBtn.addEventListener('click',applySampleToProduct);
  els.garmentGrid.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;state.garmentId=b.dataset.id;state.sizeIndex=Math.min(3,garment().sizes.length-1);state.productDims=null;renderGarments();renderSizes();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  els.sizeChips.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;state.sizeIndex=Number(b.dataset.i);state.productDims=null;renderSizes();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  els.productDimensionsFields.addEventListener('input',()=>{readProductDimensions();updateDimensionSummary();els.productResultCard.hidden=true;state.product=null;renderMatches();});
  [els.productGauge,els.productRowGauge,els.productMeterage].forEach(input=>input.addEventListener('input',()=>{state.product=null;els.productResultCard.hidden=true;els.productValidation.textContent='';renderMatches();updateGaugeHint();}));
  $('#calculateProductBtn').addEventListener('click',calculateProduct);
  $('#goMatchBtn').addEventListener('click',()=>{state.matchMode='product';state.matchSearchRequested=true;renderMatches();switchView('match');});$('#copyProductBtn').addEventListener('click',copyProduct);
  els.refreshCatalogBtn.addEventListener('click',()=>loadCatalogAndSync(true));
  els.matchModeCharacteristics.addEventListener('click',()=>{state.matchMode='characteristics';state.matchSearchRequested=false;renderMatches();});
  els.matchModeProduct.addEventListener('click',()=>{state.matchMode='product';state.matchSearchRequested=false;renderMatches();});
  els.matchManualMeterage.addEventListener('input',()=>{state.matchManualMeterage=els.matchManualMeterage.value;state.matchSearchRequested=false;renderMatches();});
  els.matchColorEnabled.addEventListener('change',()=>{
    state.matchFilters.colorEnabled=els.matchColorEnabled.checked;
    state.matchSearchRequested=false;renderMatches();
  });
  els.matchColorOptions.addEventListener('change',e=>{
    const input=e.target.closest('[data-match-color]');if(!input)return;
    const key=String(input.dataset.matchColor||'');
    const set=new Set(state.matchFilters.colors);
    if(input.checked)set.add(key);else set.delete(key);
    state.matchFilters.colors=[...set];
    state.matchSearchRequested=false;renderMatches();
  });
  els.matchCompositionEnabled.addEventListener('change',()=>{
    state.matchFilters.compositionEnabled=els.matchCompositionEnabled.checked;
    state.matchSearchRequested=false;renderMatches();
  });
  els.matchShadeEnabled.addEventListener('change',()=>{
    state.matchFilters.shadeEnabled=els.matchShadeEnabled.checked;
    state.matchSearchRequested=false;renderMatches();
    if(state.matchFilters.shadeEnabled){requestAnimationFrame(()=>{els.matchShadeQuery.focus();renderShadeSuggestions();});}
    else if(els.matchShadeSuggestions)els.matchShadeSuggestions.hidden=true;
  });
  els.matchShadeQuery.addEventListener('input',()=>{
    state.matchFilters.shadeQuery=els.matchShadeQuery.value;
    state.matchSearchRequested=false;
    renderMatches();
    renderShadeSuggestions();
  });
  els.matchShadeQuery.addEventListener('focus',renderShadeSuggestions);
  els.matchShadeSuggestions.addEventListener('click',e=>{
    const all=e.target.closest('[data-match-shade-all]');
    if(all){els.matchShadeSuggestions.hidden=true;els.matchShadeQuery.focus();return;}
    const b=e.target.closest('[data-match-shade]');if(!b)return;
    const value=decodeURIComponent(b.dataset.matchShade||'');
    state.matchFilters.shadeQuery=value;els.matchShadeQuery.value=value;els.matchShadeSuggestions.hidden=true;
    state.matchSearchRequested=false;renderMatches();
  });
  els.matchShadeQuery.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      els.matchShadeSuggestions.hidden=true;
      state.matchFilters.shadeQuery=els.matchShadeQuery.value;
      state.matchSearchRequested=false;renderMatches();
    }
  });
  els.matchCompositionOptions.addEventListener('change',e=>{
    const material=e.target.closest('[data-match-material]');
    if(material){
      const key=String(material.dataset.matchMaterial||'');
      if(material.checked){if(!Object.prototype.hasOwnProperty.call(state.matchFilters.materials,key))state.matchFilters.materials[key]='';}
      else delete state.matchFilters.materials[key];
      state.matchSearchRequested=false;renderMatches();return;
    }
    const minInput=e.target.closest('[data-match-material-min]');
    if(minInput){
      const key=String(minInput.dataset.matchMaterialMin||'');
      if(Object.prototype.hasOwnProperty.call(state.matchFilters.materials,key))state.matchFilters.materials[key]=minInput.value;
      state.matchSearchRequested=false;renderMatches();
    }
  });
  els.runMatchSearchBtn.addEventListener('click',()=>{
    state.matchSearchRequested=true;
    renderMatches();
    if(!matchContext())showToast(state.matchMode==='product'?'Сначала рассчитайте изделие':'Выберите хотя бы одно условие');
  });
  document.addEventListener('click',e=>{
    if(els.matchShadeSuggestions&&!e.target.closest('#matchShadeSearch'))els.matchShadeSuggestions.hidden=true;
    const imageButton=e.target.closest('[data-image-src]');
    if(imageButton){
      openPhotoLightbox(decodeURIComponent(imageButton.dataset.imageSrc||''),decodeURIComponent(imageButton.dataset.imageFallback||''),decodeURIComponent(imageButton.dataset.imageTitle||''));
      return;
    }
    const b=e.target.closest('[data-open]');if(!b)return;const url=decodeURIComponent(b.dataset.open);window.open(url,'_blank','noopener,noreferrer');
  });
  els.photoLightboxClose?.addEventListener('click',closePhotoLightbox);
  els.photoLightbox?.addEventListener('click',e=>{if(e.target===els.photoLightbox||e.target.classList?.contains('photo-lightbox-stage'))closePhotoLightbox();});
  els.photoLightbox?.addEventListener('pointerdown',startPhotoSwipe);
  els.photoLightbox?.addEventListener('pointerup',endPhotoSwipe);
  els.photoLightbox?.addEventListener('pointercancel',()=>{photoLightboxSwipe=null;});
  els.photoLightboxImage?.addEventListener('error',()=>{
    const fallback=els.photoLightboxImage.dataset.fallback||'';
    if(fallback&&els.photoLightboxImage.src!==fallback){els.photoLightboxImage.dataset.fallback='';els.photoLightboxImage.src=fallback;}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&els.photoLightbox&&!els.photoLightbox.hidden)closePhotoLightbox();});

  renderYarns();renderGarments();renderSizes();updateGaugeHint();renderMatches();initVK();
})();
