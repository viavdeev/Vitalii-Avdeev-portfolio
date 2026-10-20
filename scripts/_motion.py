import subprocess,sys,numpy as np
def motion(f,w=96):
    p=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip().split(',')
    W,H=int(p[0]),int(p[1]); n,d=map(int,p[2].split('/')); fps=n/d
    h=int(round(H*w/W/2)*2)
    raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf',f'fps=30,scale={w}:{h},format=gray','-f','rawvideo','-'],capture_output=True).stdout
    fr=np.frombuffer(raw,np.uint8).reshape(-1,h,w).astype(float)
    m=np.abs(np.diff(fr,axis=0)).mean(axis=(1,2))
    return m  # per 1/30s
if __name__=='__main__':
    for f in sys.argv[1:]:
        m=motion(f); T=len(m)/30
        thr=0.05
        act=np.where(m>thr)[0]
        print(f, 'dur %.2f'%T, 'first motion %.2fs'%(act[0]/30), 'last motion %.2fs'%(act[-1]/30), 'tail idle %.2fs'%(T-act[-1]/30))
        # tail profile last 3s in 0.25s bins
        tail=m[-90:]; print('  tail motion per .25s:',' '.join('%.2f'%tail[i:i+8].mean() for i in range(0,90,8)))
        head=m[:60]; print('  head motion per .25s:',' '.join('%.2f'%head[i:i+8].mean() for i in range(0,60,8)))
