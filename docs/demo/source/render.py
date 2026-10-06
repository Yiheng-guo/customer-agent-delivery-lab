"""Render a narrated tutorial from genuine CUA page captures.

Requires Pillow, FFmpeg, and macOS say. No browser automation is performed here.
Usage: python render.py --ffmpeg /absolute/path/to/ffmpeg
"""
import argparse, json, math, subprocess, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser()
p.add_argument('--ffmpeg', required=True)
args = p.parse_args()
root = Path(__file__).resolve().parents[3]
folder = root / 'docs/demo'
out = folder / 'rendered'
out.mkdir(exist_ok=True)
font_path = '/System/Library/Fonts/STHeiti Medium.ttc'
font = lambda size: ImageFont.truetype(font_path, size)
shots = [
 ('01-overview', '从这里开始体验', '点击左侧「客服体验」，走完一次完整交付。', '这是交付台，企业客服交付实验室。你可以直接打开公开链接，不需要登录。下面用一套虚构业务，走完提问、交接、回归和归档。'),
 ('02-chat', '01 / 进入客服体验', '先用来源规则模式；公网版不会调用真实模型。', '第一步，点击客服体验。公开版本使用来源规则，不调用真实模型。不要输入真实账号、订单或敏感信息。'),
 ('03-question', '02 / 输入问题并发送', '试着问：试用多久，需要绑定付款吗？', '输入，试用多久，需要绑定付款吗？也可以点击页面上的示例问题。示例只会填入输入框，还需要点击发送问题。'),
 ('04-answer', '03 / 读取回答与来源', '答案下方的 K02 来源卡可以点击。', '发送以后，可以看到十四天试用、最多二十位成员，以及不要求绑定付款方式。答案下面保留了知识编号和当时的版本。'),
 ('05-source', '04 / 打开证据来源', '核对原文、责任人、版本和有效期。', '点击来源卡，打开资料原文。你可以核对责任人、版本和有效期。这里的资料是随项目提供的虚构教学来源，不是真实客户文档。'),
 ('06-handoff', '05 / 报价问题转人工', '询问企业报价 → 点击「创建本地人工工单」。', '再开启新会话，问两百人企业版多少钱。系统不会擅自承诺价格，而是建议转人工。点击创建本地人工工单，把问题和转交原因一起留下。'),
 ('07-ticket', '06 / 查看待接单工单', '左侧「人工交接」→「模拟客服接单」。', '点击左侧人工交接，可以看到待接单工单。这里保留了问题、转交原因和知识版本。点击模拟客服接单，进入处理流程。'),
 ('08-accept', '07 / 记录接单说明', '填写下一步核实什么，再保存处理记录。', '填写接单说明。例如先确认成员数、采购周期和功能需求，再核实报价。保存以后，工单进入已接单状态。这是本地角色模拟，没有联系真实客服。'),
 ('09-closed', '08 / 关闭工单并留存过程', '填写结果并关闭，历史记录仍然保留。', '接着点击填写结果并关闭，写清楚处理结果和后续安排。关闭之后，创建、接单和处理记录仍然保留，不会只剩下一个已完成标记。'),
 ('10-run', '09 / 运行规则回归', '左侧「回归与证据」→「运行规则回归」。', '接下来打开回归与证据，点击运行规则回归。只有实际运行之后，界面才展示数字，不会预填成功率。'),
 ('11-report', '10 / 阅读回归结果', '20 条固定合成题；不能当作真实客服准确率。', '报告比较故意缺少边界的旧检索和当前规则策略。本次当前策略通过二十条固定合成题。这不代表真实客服准确率，也不是大模型之间的比较。'),
 ('12-case', '11 / 展开失败原文', '点击「展开」，核对前后答案和失败原因。', '点击第四题的展开，可以看到旧检索错误引用了过期的十四天退款规则。当前答案引用七天规则，并保留适用条件和人工核实要求。失败原因和原始答案都留下了。'),
 ('13-knowledge-lower', '12 / 检查知识治理', '公开版只读；本机版可编辑、发布、回退。', '来源知识库列出资料的版本、有效期和可见范围。过期资料、内部资料和待审核资料会被排除。公开版只读，本机完整版才支持编辑、发布和回退。'),
 ('14-checklist', '13 / 看清交付边界', '已实现、教学演示、待验证分别标注。', '打开交付清单，向下查看验收条目。来源追溯和规则回归已有记录。真实模型仍待验证，身份鉴权、备份恢复和真实负载还没有完成上线验收。'),
 ('14-delivery', '14 / 导出交付档案', '点击「导出交付档案」，保存当前浏览器记录。', '回到页面上方，点击导出交付档案，可以保存当前浏览器中的对话、工单和回归记录。分享之前请检查输入内容。导出暂时不支持导入恢复。'),
 ('16-final', '现在，轮到你体验', '提问看来源 → 创建工单 → 跑回归 → 导出档案', '现在你可以按同样步骤体验。公开版的记录只保存在当前浏览器，清除浏览器数据会丢失。需要真实模型和知识发布时，再运行仓库里的本机完整版。'),
]
timeline = []
start = 0
for i, (image_id, title, caption, narration) in enumerate(shots):
    canvas = Image.new('RGB', (1920,1080), '#f7f8f3')
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((36,24,100,80), radius=12, fill='#215b49')
    d.text((48,33), f'{i+1:02}', font=font(31), fill='#efe8d4')
    d.text((125,19), title, font=font(56), fill='#203831')
    d.text((1520,37), '交付台 · 操作演示', font=font(25), fill='#758078')
    shot = Image.open(folder/'frames'/f'{image_id}.png').convert('RGB')
    shot.thumbnail((1440,810), Image.Resampling.LANCZOS)
    # Keep the 720p native image sharp and scale only moderately to the final canvas.
    shot = shot.resize((1440,810), Image.Resampling.LANCZOS)
    canvas.paste(shot, (240,100))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((239,99,1681,911), radius=2, outline='#cfd9cb', width=2)
    lines=['']
    for char in caption:
        if d.textlength(lines[-1]+char,font=font(56))>1600:
            lines.append('')
        lines[-1]+=char
    for n,line in enumerate(lines):
        d.text((160,920+n*64),line,font=font(56),fill='#203831')
    if i == len(shots)-1:
        d.rectangle((270,340,1710,650), fill='#215b49')
        d.text((325,380), '公开体验 · 无需登录', font=font(48), fill='#efe8d4')
        d.text((285,470), 'yiheng-guo.github.io/customer-agent-delivery-lab/', font=font(56), fill='white')
        d.text((325,550), '虚构业务 / 来源规则 / 浏览器本地保存', font=font(29), fill='#efe8d4')
    still = out / f'{i:02}.png'
    canvas.save(still)
    speech = out / f'{i:02}.txt'
    speech.write_text(narration, encoding='utf-8')
    aiff, wav = out/f'{i:02}.aiff', out/f'{i:02}.wav'
    subprocess.run(['say','-v','Tingting','-r','205','-f',str(speech),'-o',str(aiff)],check=True)
    subprocess.run([args.ffmpeg,'-y','-hide_banner','-loglevel','error','-i',str(aiff),'-ar','48000','-ac','1',str(wav)],check=True)
    with wave.open(str(wav)) as w:
        duration = max(6, math.ceil(w.getnframes()/w.getframerate()+1.5))
    clip = out / f'{i:02}.mp4'
    subprocess.run([args.ffmpeg,'-y','-hide_banner','-loglevel','error','-loop','1','-framerate','24','-i',str(still),'-i',str(wav),'-vf',f'fade=t=in:st=0:d=0.25,drawbox=x=0:y=1074:w=iw*t/{duration}:h=6:color=0x215b49:t=fill','-af','apad','-t',str(duration),'-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k',str(clip)],check=True)
    timeline.append(dict(index=i+1,start=start,duration=duration,frame=image_id,title=title,caption=caption,narration=narration))
    start += duration
    print(f'{i+1}/{len(shots)} rendered ({duration}s)',flush=True)
concat = out/'concat.txt'
concat.write_text(''.join(f"file '{out/f'{i:02}.mp4'}'\n" for i in range(len(shots))))
target = root/'public/demo/walkthrough.mp4'
subprocess.run([args.ffmpeg,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(target)],check=True)
timeline_text=json.dumps(timeline,ensure_ascii=False,indent=2)
(folder/'source/timeline.json').write_text(timeline_text)
(root/'public/demo/timeline.json').write_text(timeline_text)
Image.open(out/'00.png').save(root/'public/demo/poster.jpg',quality=90)
def timestamp(seconds):
    ms=round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
cues=['WEBVTT\n']
for row in timeline:
    # Split long narration captions into comfortably readable text chunks.
    import re
    clauses=re.findall(r'[^。！？]+[。！？]?',row['narration'])
    total=sum(len(c) for c in clauses)
    elapsed=0
    for clause in clauses:
        length=(row['duration']-1.5)*len(clause)/total
        cues.append(f"{timestamp(row['start']+elapsed)} --> {timestamp(row['start']+elapsed+length)}\n{clause}\n")
        elapsed+=length
(root/'public/demo/captions.vtt').write_text('\n'.join(cues))
print(f'Completed: {start}s {target}',flush=True)
