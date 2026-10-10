"""The numbers in docs/ring-or-helix.md: the per-period screw motion (turn angle and
slide) of the 3D polyarc walk for polygonal numbers under two-residue tilt rules,
and the reflection-symmetry centre of each turn sequence, if any.

The walk is the one in src/viz3d/polyarc3d.ts (yaw about up, pitch about left,
each step an exact unit arc). Needs numpy.

  python scripts/ring-or-helix.py
"""
import math
import numpy as np

def rot(axis, angle):
    """Rotation matrix for `angle` about the unit vector `axis` (Rodrigues)."""
    x,y,z=axis; c,s=math.cos(angle),math.sin(angle); C=1-c
    return np.array([[c+x*x*C, x*y*C-z*s, x*z*C+y*s],
                     [y*x*C+z*s, c+y*y*C, y*z*C-x*s],
                     [z*x*C-y*s, z*y*C+x*s, c+z*z*C]])

def period_motion(T, bend, tilt):
    """Walk the terms T; return (turn angle in degrees, |slide|) of the rigid motion
    carrying the start frame to the end frame."""
    P=np.zeros(3); H=np.array([1.0,0,0]); L=np.array([0,1.0,0]); U=np.array([0,0,1.0])
    for a in T:
        yaw=math.radians(bend(a)); pitch=math.radians(tilt(a)); phi=math.hypot(yaw,pitch)
        if phi<1e-12: P=P+H; continue
        w=(yaw*U+pitch*L)/phi; side=np.cross(w,H)
        P=P+(math.sin(phi)/phi)*H+((1-math.cos(phi))/phi)*side
        R=rot(w,phi); H=R@H; L=R@L; H/=np.linalg.norm(H); L-=H*(L@H); L/=np.linalg.norm(L); U=np.cross(H,L)
    R=np.array([H,L,U]).T
    ang=math.degrees(math.acos(max(-1,min(1,(np.trace(R)-1)/2))))
    w,v=np.linalg.eig(R); axis=np.real(v[:,np.argmin(abs(w-1))]); axis/=np.linalg.norm(axis)
    return ang, abs(float(P@axis))

def signed(r,m): return r if 2*r<m else r-m
def poly(a): return lambda n:(a*n*n+(2-a)*n)//2
NAMES={1:'triangular',2:'squares',3:'pentagonal',4:'hexagonal',5:'heptagonal',6:'octagonal',7:'nonagonal',8:'decagonal'}

def turn_period(f,M):
    s=[f(n)%M for n in range(4*M+100)]
    return next(p for p in range(1,2*M+1) if s[:2*M]==s[p:p+2*M])

def centre(f,M,p):
    """An integer c with f(c-n) = f(n) mod M for all n (searched over one index period), or None."""
    for c in range(p):
        if all((f(c-n)-f(n))%M==0 for n in range(p)): return c if c<p//2 else c-p
    return None

def table(title, cases, bend, tilt, M):
    print(title); print('  sequence     period   turn(deg)   slide        centre')
    for a in cases:
        f=poly(a); p=turn_period(f,M); ang,sl=period_motion([f(n) for n in range(p)],bend,tilt); c=centre(f,M,p)
        print(f'  {NAMES[a]:11s} {p:6d}   {ang:8.3f}   {sl:9.2e}   {"none" if c is None else f"c = {c}"}')

if __name__=='__main__':
    table('bend 1 deg x (a mod 360) - 180; tilt (360/7) deg x signed(a mod 7); M = 2520',
          range(1,9), lambda v:-((v%360)-180), lambda v:360/7*signed(v%7,7), 2520)
    table('bend (360/7) deg x (a mod 7) - 180; tilt (360/11) deg x signed(a mod 11); M = 77',
          (2,3,4), lambda v:-(360/7*(v%7)-180), lambda v:360/11*signed(v%11,11), 77)
