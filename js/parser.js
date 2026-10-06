(function(){
  const aliases={
    'па':'полиамид','polyamide':'полиамид','nylon':'полиамид','полиамид':'полиамид',
    'wv':'шерсть','wool':'шерсть','шерсть':'шерсть',
    'меринос':'меринос','merino':'меринос','мериносовая шерсть':'меринос','шерсть мериноса':'меринос',
    'кашемир':'кашемир','cashmere':'кашемир',
    'альпака':'альпака','alpaca':'альпака',
    'беби верблюд':'беби верблюд','верблюд':'верблюд','camel':'верблюд',
    'мохер':'мохер','mohair':'мохер','ангора':'ангора','angora':'ангора',
    'хлопок':'хлопок','cotton':'хлопок','лен':'лён','лён':'лён','linen':'лён',
    'вискоза':'вискоза','viscose':'вискоза','шелк':'шёлк','шёлк':'шёлк','silk':'шёлк',
    'полиэстер':'полиэстер','polyester':'полиэстер','акрил':'акрил','acrylic':'акрил',
    'эластан':'эластан','elastane':'эластан','лайкра':'эластан','lycra':'эластан'
  };
  const knownBrands=['Cariaggi','Lanecardate','Biagioli Modesto','Loro Piana','Zegna Baruffa','Filpucci','Igea','Lineapiu','Lineapiù','Pecci Filati','Botto Giuseppe','Tollegno','Xinao'];
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const num=s=>Number(String(s).replace(',','.'));
  const escapeRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function grams(value,unit){const v=num(value);return /кг/i.test(unit||'')?v*1000:v;}
  function field(raw,labels){
    const names=(Array.isArray(labels)?labels:[labels]).map(escapeRe).join('|');
    const re=new RegExp('^\\s*(?:'+names+')\\s*:\\s*(.*?)\\s*$','im');
    const m=re.exec(String(raw||''));
    return m?m[1].trim():null;
  }
  function normalizeMaterial(raw){
    const t=clean(raw).toLowerCase().replace(/^[\s:–—-]+|[\s:–—-]+$/g,'');
    const rules=[
      [/кашемир|cashmere/,'кашемир'],[/беби\s*верблюд/,'беби верблюд'],[/верблюд|camel/,'верблюд'],
      [/меринос|merino/,'меринос'],[/альпака|alpaca/,'альпака'],[/мохер|mohair/,'мохер'],[/ангора|angora/,'ангора'],
      [/полиамид|polyamide|nylon|(^|\s)па($|\s)/,'полиамид'],[/полиэстер|polyester/,'полиэстер'],[/акрил|acrylic/,'акрил'],[/эластан|elastane|лайкра|lycra/,'эластан'],
      [/хлопок|cotton/,'хлопок'],[/л[её]н|linen/,'лён'],[/вискоза|viscose/,'вискоза'],[/ш[её]лк|silk/,'шёлк'],[/шерсть|wool|(^|\s)wv($|\s)/,'шерсть']
    ];
    for(const [re,v] of rules){if(re.test(t))return v}return t;
  }
  function parseComposition(text){
    const items=[]; const re=/(\d{1,3}(?:[.,]\d+)?)\s*%\s*([^,;\.\n\r]+)/gi; let m;
    while((m=re.exec(String(text||'')))){
      let material=normalizeMaterial(m[2].replace(/\b(гребенн\w*|экстрафайн|superfine|extra\s*fine|с\s+пайетками)\b/gi,' '));
      if(material)items.push({percent:num(m[1]),material});
    }
    return items.filter((x,i,a)=>i===a.findIndex(y=>y.material===x.material&&y.percent===x.percent));
  }
  function parseMeterage(text){
    const patterns=[
      /(\d+(?:[.,]\d+)?)\s*(?:г|гр|грамм\w*)\s*[\/хx×\-–—:]?\s*(\d+(?:[.,]\d+)?)\s*(?:м|метр\w*)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:м|метр\w*)\s*[\/хx×\-–—:]?\s*(\d+(?:[.,]\d+)?)\s*(?:г|гр|грамм\w*)/i
    ];
    let m=patterns[0].exec(String(text||'')); if(m){const w=num(m[1]),meters=num(m[2]);if(w>0&&meters>0)return{meters,grams:w,metersPer100g:Math.round(meters/w*100)}}
    m=patterns[1].exec(String(text||'')); if(m){const meters=num(m[1]),w=num(m[2]);if(w>0&&meters>0)return{meters,grams:w,metersPer100g:Math.round(meters/w*100)}}
    return null;
  }
  function parsePrice(text){
    text=String(text||'');
    let m=/(\d+(?:[.,]\d+)?)\s*(?:г|гр|грамм\w*)\s*[\/]\s*(\d+(?:[.,]\d+)?)\s*(?:руб(?:\.|лей)?|₽|р\.?)(?!\w)/i.exec(text);
    if(m){const basis=num(m[1]),price=num(m[2]);return{price,basisGrams:basis,pricePer100g:Math.round(price/basis*100)}}
    m=/(\d+(?:[.,]\d+)?)\s*(?:руб(?:\.|лей)?|₽|р\.?)\s*(?:за\s*)?[\/]?\s*(\d+(?:[.,]\d+)?)\s*(?:г|гр|грамм\w*)/i.exec(text);
    if(m){const price=num(m[1]),basis=num(m[2]);return{price,basisGrams:basis,pricePer100g:Math.round(price/basis*100)}}
    return null;
  }
  function parseStockDetailed(text){
    const source=String(text||'').replace(/\u00a0/g,' ').trim();
    const label=/(?:наличие|в\s+наличии|остаток|осталось|есть|вес)\s*[:\-–—]?\s*/i;
    const lm=label.exec(source);if(!lm)return {totalGrams:null,bobbinsGrams:[]};
    let tail=source.slice(lm.index+lm[0].length).split(/\n|\r|\.(?=\s|$)/)[0].trim();
    if(!tail)return {totalGrams:null,bobbinsGrams:[]};

    // Цифры-эмодзи keycap (1️⃣…9️⃣) используются в описаниях как номера бобин.
    // Они содержат обычную цифру внутри Unicode-последовательности, поэтому без
    // нормализации парсер мог принять, например, «2️⃣1190 г» за 2 г.
    // Заменяем такие маркеры разделителем, сохраняя следующие за ними веса.
    tail=tail.replace(/[0-9](?:\uFE0F)?\u20E3/g,';').replace(/;\s*;/g,';').trim();

    // Сначала разбираем случаи, где единица указана у каждой бобины:
    // «0,45 кг, 0,62 кг» или «450 г + 620 г».
    const explicit=[];let em;
    const eachRe=/(\d+(?:[.,]\d+)?)\s*(кг|гр\.?|грам(?:м|ма|мов|мы)?|г)(?=\s|$|[,;+\/])/gi;
    while((em=eachRe.exec(tail))){const g=grams(em[1],em[2]);if(Number.isFinite(g)&&g>0)explicit.push(Math.round(g));}
    if(explicit.length>1)return {totalGrams:explicit.reduce((a,b)=>a+b,0),bobbinsGrams:explicit};

    // Если единица одна в конце, допускаем перечень весов бобин через запятую,
    // «+», «/» или «;»: «430, 520, 610 г» -> 1560 г.
    const um=/(кг|гр\.?|грам(?:м|ма|мов|мы)?|г)(?=\s|$|[.,;+\/])/i.exec(tail);
    if(!um){
      // Для старых карточек допускаем перечень нескольких целых весов без единицы:
      // «Наличие: 430, 520, 610». Одинокое число без единицы намеренно не угадываем.
      const rawList=tail.split(/\b(?:цена|руб|₽)\b/i)[0].trim();
      const looksLikeList=/[+;/]/.test(rawList)||/,\s+\d/.test(rawList)||/^\d+(?:,\d+){2,}$/.test(rawList);
      if(looksLikeList){
        const values=rawList.split(/\s*(?:\+|;|\/|,\s+)\s*|(?<=\d),(?=\d{2,}(?:,|$))/).map(x=>num(x.trim())).filter(x=>Number.isFinite(x)&&x>=10);
        if(values.length>1){const bobbins=values.map(Math.round);return {totalGrams:bobbins.reduce((a,b)=>a+b,0),bobbinsGrams:bobbins};}
      }
      return {totalGrams:null,bobbinsGrams:[]};
    }
    const unit=um[1];let numberPart=tail.slice(0,um.index).trim();
    numberPart=numberPart.replace(/\([^)]*\)/g,' ').trim();
    const commaAsGramList=/^(?:\d{2,4}),\d{3,4}$/.test(numberPart)&&!/^кг$/i.test(unit);
    const hasListSeparator=/[+;/]/.test(numberPart)||/,\s+\d/.test(numberPart)||/^\d+(?:,\d+){2,}$/.test(numberPart)||commaAsGramList;
    let values=[];
    if(hasListSeparator){
      values=numberPart.split(/\s*(?:\+|;|\/|,\s+)\s*|(?<=\d),(?=\d{2,}(?:,|$))/).map(x=>x.trim()).filter(Boolean).map(num).filter(x=>Number.isFinite(x)&&x>0);
    }else{
      const v=num(numberPart.match(/\d+(?:[.,]\d+)?/)?.[0]||'');if(Number.isFinite(v)&&v>0)values=[v];
    }
    if(!values.length&&explicit.length===1)return {totalGrams:explicit[0],bobbinsGrams:explicit};
    const bobbins=values.map(v=>Math.round(/кг/i.test(unit)?v*1000:v));
    return {totalGrams:bobbins.length?bobbins.reduce((a,b)=>a+b,0):null,bobbinsGrams:bobbins};
  }
  function parseStock(text){return parseStockDetailed(text).totalGrams;}
  function parseColor(text){
    let m=/\bCol\.?\s*([^\.\n\r]+?)(?=\.\s|$)/i.exec(String(text||''));if(m)return clean(m[1]);
    m=/(?:цвет|цвета)\s*[:\-–—]?\s*([^\.\n\r]+)/i.exec(String(text||''));return m?clean(m[1]):null;
  }
  function parseYarnCount(text){const matches=[...String(text||'').matchAll(/\((\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?)\)/g)];return matches.length?matches[0][1].replace(/\s/g,''):null;}
  function parseCountry(text){if(/италия/i.test(String(text||'')))return 'Италия';return null;}
  function parseBrand(text){for(const b of knownBrands){if(new RegExp('(?:^|[.\\s])'+escapeRe(b)+'(?:[.\\s]|$)','i').test(String(text||'')))return b}return null;}
  function parseName(text,brand){
    let m=/\bArt\.?\s*([^\.\n\r]+)/i.exec(String(text||''));if(m)return clean(m[1]);
    const chunks=String(text||'').split('.').map(clean).filter(Boolean);
    const skip=/^(италия|stock\s*yarn(?:\s*italy)?|цвет|col\b|в наличии|остаток|осталось)/i;
    for(const c of chunks){if(c===brand||skip.test(c)||/%/.test(c)||/\d+\s*г\s*\/\s*\d+\s*м/i.test(c)||/руб|₽/i.test(c))continue;if(c.length>2&&c.length<80)return c;}
    return brand||'Пряжа';
  }
  function parseDescription(raw,extra={}){
    const source=String(raw||'');
    const structured={
      country:field(source,['Страна']),
      brand:field(source,['Производитель','Бренд']),
      title:field(source,['Артикул/название','Артикул / название','Название']),
      article:field(source,['Артикул','Art','Арт']),
      shade:field(source,['Оттенок']),
      color:field(source,['Цвет','Col']),
      composition:field(source,['Состав']),
      meterage:field(source,['Метраж']),
      stock:field(source,['Наличие','Остаток','В наличии','Вес']),
      price:field(source,['Цена'])
    };
    const legacy=clean(source.replace(/^\s*#(?:калькулятор|манияпряжи)\s*$/gim,' '));
    const meterage=parseMeterage(structured.meterage||legacy);
    const price=parsePrice(structured.price||legacy);
    const brand=structured.brand||parseBrand(legacy);
    const composition=parseComposition(structured.composition||legacy);
    const stockInfo=parseStockDetailed(structured.stock?`Остаток: ${structured.stock}`:legacy);
    const stockValue=stockInfo.totalGrams;
    const properties=[];if(/пайетк/i.test(source))properties.push('пайетки');if(/экстрафайн|extra\s*fine/i.test(source))properties.push('экстрафайн');if(/гребенн/i.test(source))properties.push('гребенной');if(/моточн/i.test(source))properties.push('моточная');if(/бобин/i.test(source))properties.push('бобинная');
    const confidence={meterage:meterage?'high':'none',composition:composition.length?'high':'none',stock:stockValue!=null?'high':'none',price:price?'high':'none'};
    return {
      id:extra.id||('local-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),
      photoUrl:extra.photoUrl||'',sourceText:clean(source),
      country:structured.country||parseCountry(legacy),
      brand,
      name:structured.title||structured.article||parseName(legacy,brand),
      article:structured.article||null,
      color:structured.color||parseColor(legacy),
      shade:structured.shade||null,
      composition,properties,meterage,yarnCount:parseYarnCount(legacy),
      stockGrams:stockValue,
      stockBobbinsGrams:stockInfo.bobbinsGrams,
      pricePer100g:price?price.pricePer100g:null,
      confidence
    };
  }
  window.ManiaParser={parseDescription,parseMeterage,parseComposition,parseStock,parseStockDetailed};
})();
