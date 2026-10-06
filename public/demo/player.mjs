const video=document.querySelector('#video');
const time=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
try {
  const response=await fetch('./timeline.json');
  if(!response.ok) throw new Error('Timeline unavailable');
  const rows=await response.json();
  for(const row of rows){
    const button=document.createElement('button');
    button.textContent=`${time(row.start)} · ${row.title}`;
    button.addEventListener('click',async()=>{
      if(video.readyState===0){
        await new Promise(resolve=>video.addEventListener('loadedmetadata',resolve,{once:true}));
      }
      if(row.start>0&&video.seekable.length===0){
        document.querySelector('#player-status').textContent='当前服务器不支持章节跳转，可从头播放或下载视频。';
        return;
      }
      video.currentTime=row.start;
      video.play().catch(()=>{});
      video.scrollIntoView({block:'center',behavior:'smooth'});
    });
    document.querySelector('#chapters').append(button);
    const p=document.createElement('p');
    p.textContent=`${time(row.start)} ${row.title}：${row.narration}`;
    document.querySelector('#transcript').append(p);
  }
} catch {
  document.querySelector('#player-status').textContent='章节暂时无法加载，仍可使用播放器观看或下载视频。';
}
