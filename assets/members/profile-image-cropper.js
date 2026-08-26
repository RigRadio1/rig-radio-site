(() => {
  const state = { active: null };

  const style = document.createElement('style');
  style.textContent = `
    .rr-crop-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.82)}
    .rr-crop-card{width:min(720px,96vw);max-height:94vh;overflow:auto;border:1px solid rgba(255,106,42,.45);border-radius:24px;background:#171717;color:#fff;box-shadow:0 30px 100px rgba(0,0,0,.7);padding:20px}
    .rr-crop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .rr-crop-head h3{margin:0;font-size:1.25rem}
    .rr-crop-close{border:0;background:#2d2d2d;color:#fff;width:38px;height:38px;border-radius:999px;font-size:1.3rem;cursor:pointer}
    .rr-crop-stage{display:grid;place-items:center;background:#090909;border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:14px;overflow:hidden;touch-action:none}
    .rr-crop-canvas{display:block;max-width:100%;height:auto;border-radius:14px;cursor:grab;touch-action:none;box-shadow:0 0 0 1px rgba(255,106,42,.45)}
    .rr-crop-canvas:active{cursor:grabbing}
    .rr-crop-controls{display:grid;gap:10px;margin-top:16px}
    .rr-crop-controls label{font-weight:800;color:#eee}
    .rr-crop-controls input[type=range]{width:100%;accent-color:#ff6a2a}
    .rr-crop-hint{margin:0;color:#aaa;font-size:.9rem}
    .rr-crop-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
    .rr-crop-actions button{min-height:42px;padding:0 18px;border-radius:999px;font-weight:900;cursor:pointer}
    .rr-crop-cancel{background:#242424;color:#fff;border:1px solid #4b4b4b}
    .rr-crop-apply{background:linear-gradient(135deg,#ff6a2a,#e53128);color:#fff;border:1px solid #ff7a3a}
    .edit-avatar-preview.rr-has-preview{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;color:transparent!important}
    #bannerUploadButton.rr-has-preview{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;min-height:170px!important}
    #bannerUploadButton.rr-has-preview > span,#bannerUploadButton.rr-has-preview > p{opacity:0}
  `;
  document.head.appendChild(style);

  function loadImage(file){
    return new Promise((resolve,reject)=>{
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
      img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
      img.src=url;
    });
  }

  function makeModal(kind, file, input){
    const avatar = kind === 'avatar';
    const outW = avatar ? 800 : 1280;
    const outH = avatar ? 800 : 740;
    const viewW = avatar ? 420 : 640;
    const viewH = Math.round(viewW * outH / outW);

    const modal = document.createElement('div');
    modal.className='rr-crop-modal';
    modal.innerHTML=`
      <section class="rr-crop-card" role="dialog" aria-modal="true" aria-label="Adjust ${avatar ? 'profile picture' : 'profile banner'}">
        <div class="rr-crop-head"><h3>Adjust ${avatar ? 'Profile Picture' : 'Profile Banner'}</h3><button class="rr-crop-close" type="button">×</button></div>
        <div class="rr-crop-stage"><canvas class="rr-crop-canvas" width="${viewW}" height="${viewH}"></canvas></div>
        <div class="rr-crop-controls">
          <label>Zoom</label>
          <input class="rr-crop-zoom" type="range" min="1" max="3" step="0.01" value="1">
          <p class="rr-crop-hint">Drag the image to choose what stays inside the frame.</p>
        </div>
        <div class="rr-crop-actions"><button class="rr-crop-cancel" type="button">Cancel</button><button class="rr-crop-apply" type="button">Use This Crop</button></div>
      </section>`;
    document.body.appendChild(modal);

    const canvas=modal.querySelector('canvas');
    const ctx=canvas.getContext('2d');
    const zoom=modal.querySelector('.rr-crop-zoom');
    let img=null, baseScale=1, scale=1, x=0, y=0, dragging=false, px=0, py=0;

    const clamp=()=>{
      const dw=img.width*scale, dh=img.height*scale;
      const minX=canvas.width-dw, minY=canvas.height-dh;
      x=Math.min(0,Math.max(minX,x));
      y=Math.min(0,Math.max(minY,y));
    };

    const draw=()=>{
      if(!img) return;
      clamp();
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,x,y,img.width*scale,img.height*scale);
    };

    loadImage(file).then(image=>{
      img=image;
      baseScale=Math.max(canvas.width/img.width,canvas.height/img.height);
      scale=baseScale;
      x=(canvas.width-img.width*scale)/2;
      y=(canvas.height-img.height*scale)/2;
      draw();
    }).catch(err=>{ alert(err.message); modal.remove(); });

    zoom.addEventListener('input',()=>{
      if(!img) return;
      const oldScale=scale;
      const cx=(canvas.width/2-x)/oldScale;
      const cy=(canvas.height/2-y)/oldScale;
      scale=baseScale*Number(zoom.value);
      x=canvas.width/2-cx*scale;
      y=canvas.height/2-cy*scale;
      draw();
    });

    const point=e=>({x:e.clientX,y:e.clientY});
    canvas.addEventListener('pointerdown',e=>{ dragging=true; canvas.setPointerCapture(e.pointerId); const p=point(e); px=p.x; py=p.y; });
    canvas.addEventListener('pointermove',e=>{ if(!dragging||!img)return; const p=point(e); const rect=canvas.getBoundingClientRect(); const sx=canvas.width/rect.width, sy=canvas.height/rect.height; x+=(p.x-px)*sx; y+=(p.y-py)*sy; px=p.x; py=p.y; draw(); });
    canvas.addEventListener('pointerup',()=>dragging=false);
    canvas.addEventListener('pointercancel',()=>dragging=false);

    const close=()=>{ modal.remove(); input.value=''; };
    modal.querySelector('.rr-crop-close').onclick=close;
    modal.querySelector('.rr-crop-cancel').onclick=close;

    modal.querySelector('.rr-crop-apply').onclick=()=>{
      if(!img) return;
      const out=document.createElement('canvas');
      out.width=outW; out.height=outH;
      const octx=out.getContext('2d');
      const factor=outW/canvas.width;
      octx.drawImage(img,x*factor,y*factor,img.width*scale*factor,img.height*scale*factor);

      const mime=file.type==='image/png' ? 'image/png' : 'image/jpeg';
      out.toBlob(blob=>{
        if(!blob) return alert('Could not create cropped image.');
        const ext=mime==='image/png'?'png':'jpg';
        const cropped=new File([blob],`${kind}-cropped.${ext}`,{type:mime,lastModified:Date.now()});
        try{
          const dt=new DataTransfer();
          dt.items.add(cropped);
          input.files=dt.files;
        }catch(err){
          console.error('PROFILE CROP FILE REPLACE ERROR',err);
          alert('Your browser could not prepare the cropped image. Please try another browser.');
          return;
        }

        const previewUrl=URL.createObjectURL(cropped);
        if(avatar){
          const preview=document.querySelector('.edit-avatar-preview');
          if(preview){ preview.style.backgroundImage=`url("${previewUrl}")`; preview.classList.add('rr-has-preview'); preview.innerHTML=''; }
        }else{
          const box=document.getElementById('bannerUploadButton');
          if(box){ box.style.backgroundImage=`url("${previewUrl}")`; box.classList.add('rr-has-preview'); }
        }
        modal.remove();
      },mime,mime==='image/jpeg'?0.9:undefined);
    };
  }

  function bind(){
    const avatar=document.getElementById('avatarUploadInput');
    const banner=document.getElementById('bannerUploadInput');
    if(avatar && avatar.dataset.cropBound!=='1'){
      avatar.dataset.cropBound='1';
      avatar.addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) makeModal('avatar',f,avatar); });
    }
    if(banner && banner.dataset.cropBound!=='1'){
      banner.dataset.cropBound='1';
      banner.addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) makeModal('banner',f,banner); });
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();
