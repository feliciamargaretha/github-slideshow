import json, re
# Script text, using the wording you quoted while we made the graphics
paras = [
"What makes a great founder?",
"A great founder has the judgement to make sound decisions, recognize opportunities, and mobilise the resources around them.",
"A great founder programme should help participants develop these capabilities while growing with them. For me, that means creating a journey that evolves alongside participants, from their first day to their next steps after the programme. Not everyone will immediately build the next decacorn, but they should leave better equipped to take on that challenge.",
"Each cohort brings different people, so I'd start by understanding what participants hope to get. This would help us identify common needs and tailor parts of the programme accordingly.",
"Beyond personalized approach, I'd also focus on developing acumen through practical experience.",
"Around 50% of unicorn founders had previously worked at a startup.",
"We could bring this experience closer by giving participants opportunities to shadow founders or work at a startup, or alternatively inviting those founders to bring real challenges for participants.",
"To understand what makes Founder Sprint valuable, I spoke with alumni. They highlighted how much they valued the people they met and the challenges they faced together, not just the knowledge they gained.",
"Having been in both sides of entrepreneurship program, I've seen how these kind of meaningful interactions create lasting valuable insights. But they rarely happen by chance; they need to be intentionally designed.",
"In response to this, I'd build a culture of collaborative learning, with a weekly rhythm where teams present their progress and get feedback from peers who take on different roles, offering fresh perspectives.",
"These insights could then be documented into a shared knowledge repository.",
"I'd also create a living map of networks shared by participants, alumni, and the Founder Sprint team. This would make existing expertise easier to discover and help participants utilize the networks around them.",
"My experience organising entrepreneurship events at HUBS has taught me how to facilitate meaningful interactions. My product design background also taught me to consider the entire user journey and how its different elements work together. I'd bring both perspectives to help grow Founder Sprint into a program that brings strong foundation for the next generation of ambitious founders.",
]
MAXC=84  # max characters per cue (two lines of ~42)
def split_para(p):
    sents=re.split(r'(?<=[.?!;])\s+',p)
    out=[]
    for s in sents:
        words=s.split(); cur=''
        # prefer breaking at commas when a sentence is long
        chunks=re.split(r'(?<=,)\s+',s) if len(s)>MAXC else [s]
        for ch in chunks:
            if len(cur)+len(ch)+1<=MAXC: cur=(cur+' '+ch).strip()
            else:
                if cur: out.append(cur)
                if len(ch)<=MAXC: cur=ch
                else: # hard wrap by words
                    w=ch.split(); cur=''
                    for x in w:
                        if len(cur)+len(x)+1>MAXC: out.append(cur); cur=x
                        else: cur=(cur+' '+x).strip()
        if cur: out.append(cur)
    return out
cues=[]; 
for i,p in enumerate(paras):
    for c in split_para(p): cues.append([c,i])
TOTAL=116.0; LEAD=0.3; TAIL=0.8; PARA_GAP=0.5
speak=TOTAL-LEAD-TAIL-PARA_GAP*(len(paras)-1)
w=[len(c)+12 for c,_ in cues]   # +12 gives short cues a minimum reading time
per=speak/sum(w); t=LEAD; out=[]
for k,(c,pi) in enumerate(cues):
    if k and cues[k-1][1]!=pi: t+=PARA_GAP
    d=w[k]*per; out.append({'text':c,'start':round(t,2),'end':round(t+d-0.05,2)}); t+=d
def two_lines(s):
    if len(s)<=42: return s
    best=None
    for m in re.finditer(' ',s):
        i=m.start(); score=abs(len(s[:i])-len(s[i+1:]))
        if best is None or score<best[0]: best=(score,i)
    return s[:best[1]]+'\n'+s[best[1]+1:]
for c in out: c['text']=two_lines(c['text'])
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h:02}:{m:02}:{int(s):02},{int(round((s-int(s))*1000)):03}"
with open('subtitles.srt','w') as f:
    for i,c in enumerate(out,1): f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
json.dump(out,open('cues.json','w'),indent=1)
print(len(out),'cues, last ends',out[-1]['end']); print(max(len(l) for c in out for l in c['text'].split('\n')),'max line chars')
