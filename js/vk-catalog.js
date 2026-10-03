(function(){
  'use strict';
  const C=window.MANIA_CONFIG||{};
  const P=window.ManiaParser;

  function getLaunchAppId(){
    const p=new URLSearchParams(window.location.search);
    const id=Number(p.get('vk_app_id')||0);
    return Number.isInteger(id)&&id>0?id:null;
  }
  async function initBridge(){
    if(!window.vkBridge)throw new Error('VK Bridge не загружен. Запустите приложение внутри VK.');
    await window.vkBridge.send('VKWebAppInit');
  }
  async function getToken(){
    const appId=getLaunchAppId();
    if(!appId)throw new Error('Не найден vk_app_id. Откройте калькулятор как VK Mini App.');
    const data=await window.vkBridge.send('VKWebAppGetAuthToken',{app_id:appId,scope:'photos'});
    const token=String(data?.access_token||'');
    if(!token)throw new Error('VK не вернул access token.');
    return token;
  }
  let lastApiCallAt=0;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function api(token,method,params={}){
    for(let attempt=0;attempt<4;attempt++){
      const delay=Math.max(0,360-(Date.now()-lastApiCallAt));if(delay)await wait(delay);
      lastApiCallAt=Date.now();
      try{
        const result=await window.vkBridge.send('VKWebAppCallAPIMethod',{method,params:{...params,access_token:token,v:C.VK_API_VERSION||'5.199'}});
        if(result?.error)throw result.error;
        if(!result||typeof result.response==='undefined')throw new Error(`VK API ${method} не вернул response.`);
        return result.response;
      }catch(error){
        const code=Number(error?.error_code||error?.error_data?.error_code||0);
        if(code!==6||attempt===3)throw error;
        await wait(650*(attempt+1));
      }
    }
  }
  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error('IndexedDB недоступен'));return;}
      const req=indexedDB.open(C.DB_NAME||'mania-yarn-vk-catalog',Number(C.DB_VERSION||1));
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(C.DB_STORE||'catalog'))db.createObjectStore(C.DB_STORE||'catalog');};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Не удалось открыть IndexedDB'));
    });
  }
  async function cacheGet(){
    try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(C.DB_STORE||'catalog','readonly');const req=tx.objectStore(C.DB_STORE||'catalog').get(C.DB_KEY||'vk-catalog');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}catch(_){return null;}
  }
  async function cacheSet(value){
    try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(C.DB_STORE||'catalog','readwrite');tx.objectStore(C.DB_STORE||'catalog').put(value,C.DB_KEY||'vk-catalog');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return true;}catch(error){console.warn('VK catalog cache write failed:',error);return false;}
  }
  function photoThumb(photo){
    const sizes=Array.isArray(photo?.sizes)?photo.sizes:[];if(!sizes.length)return '';
    const sorted=[...sizes].sort((a,b)=>(Number(a.width||0)*Number(a.height||0))-(Number(b.width||0)*Number(b.height||0)));
    const preferred=sorted.find(x=>Number(x.width||0)>=320)||sorted[sorted.length-1];return String(preferred?.url||'');
  }
  function vkPhotoUrl(photo){const owner=Number(photo?.owner_id||C.OWNER_ID||0),id=Number(photo?.id||0);return owner&&id?`https://vk.com/photo${owner}_${id}`:'';}
  function markerRegex(){
    const marker=String(C.PARSER_MARKER||'#Манияпряжи').trim();
    const escaped=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(?:^|\\s)'+escaped+'(?=\\s|$|[.,;:!?])','iu');
  }
  function hasParserMarker(text){return markerRegex().test(String(text||''));}

  async function loadAlbumTitles(token,onProgress){
    const wanted=new Set((C.ALBUM_IDS||[]).map(Number));const titles=new Map();let offset=0,total=null;
    for(let page=0;page<100;page++){
      const r=await api(token,'photos.getAlbums',{owner_id:Number(C.OWNER_ID),need_system:0,need_covers:0,photo_sizes:0,count:100,offset});
      const items=Array.isArray(r?.items)?r.items:[];if(total===null&&Number.isFinite(Number(r?.count)))total=Number(r.count);
      for(const a of items)if(wanted.has(Number(a?.id)))titles.set(Number(a.id),String(a.title||`Альбом ${a.id}`));
      offset+=items.length;if(typeof onProgress==='function')onProgress({phase:'albums',message:`Определяем разрешённый альбом…`});
      if(!items.length||(total!==null&&offset>=total)||titles.size>=wanted.size)break;
    }
    for(const id of wanted)if(!titles.has(id))titles.set(id,`Альбом ${id}`);return titles;
  }

  async function sync(options={}){
    const onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{};
    await initBridge();onProgress({phase:'auth',message:'Запрашиваем доступ к фотографиям…'});const token=await getToken();
    const albumTitles=await loadAlbumTitles(token,onProgress);
    const items=[];const errors=[];let totalPhotos=0,markedPhotos=0,parsedWithMeterage=0;
    const ids=(C.ALBUM_IDS||[]).map(Number).filter(Number.isInteger);const marker=String(C.PARSER_MARKER||'#Манияпряжи');
    for(let ai=0;ai<ids.length;ai++){
      const albumId=ids[ai],albumTitle=albumTitles.get(albumId)||`Альбом ${albumId}`;let offset=0,albumTotal=null;
      for(let page=0;page<Number(C.MAX_PAGES_PER_ALBUM||100);page++){
        onProgress({phase:'photos',albumIndex:ai+1,albumCount:ids.length,albumId,albumTitle,message:`${albumTitle}: проверяем фото с меткой ${marker}…`});
        let r;try{r=await api(token,'photos.get',{owner_id:Number(C.OWNER_ID),album_id:String(albumId),extended:0,photo_sizes:1,count:Number(C.PHOTOS_PAGE_SIZE||1000),offset});}catch(error){errors.push({albumId,albumTitle,error:String(error?.error_msg||error?.message||error)});break;}
        const photos=Array.isArray(r?.items)?r.items:[];const reported=Number(r?.count);if(Number.isFinite(reported)&&reported>=0)albumTotal=reported;totalPhotos+=photos.length;
        for(const photo of photos){
          const text=String(photo?.text||'').trim();
          if(!text||!hasParserMarker(text))continue;
          markedPhotos+=1;
          const parsed=P.parseDescription(text,{id:`vk-${Number(photo?.owner_id||C.OWNER_ID)}-${Number(photo?.id||0)}`,photoUrl:vkPhotoUrl(photo)});
          parsed.albumId=albumId;parsed.albumTitle=albumTitle;parsed.vkPhotoId=Number(photo?.id||0);parsed.ownerId=Number(photo?.owner_id||C.OWNER_ID);parsed.date=Number(photo?.date||0);parsed.thumbUrl=photoThumb(photo);parsed.source='vk';parsed.parserMarker=marker;
          if(parsed.meterage)parsedWithMeterage+=1;items.push(parsed);
        }
        offset+=photos.length;if(!photos.length||(albumTotal!==null&&offset>=albumTotal)||(albumTotal===null&&photos.length<Number(C.PHOTOS_PAGE_SIZE||1000)))break;
      }
    }
    const payload={schema:3,groupId:Number(C.GROUP_ID),ownerId:Number(C.OWNER_ID),albumIds:ids,parserMarker:marker,syncedAt:Date.now(),totalPhotos,markedPhotos,parsedWithMeterage,errors,items};
    await cacheSet(payload);onProgress({phase:'done',message:`Готово: найдено ${markedPhotos} фото с ${marker}, ${parsedWithMeterage} с метражом.`});return payload;
  }
  window.MANIA_VK_CATALOG={sync,loadCached:cacheGet,getLaunchAppId,config:C,hasParserMarker};
})();
