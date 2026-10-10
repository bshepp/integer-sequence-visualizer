# What is already known about these drawings, and which classes of sequences to render

**Status:** draft, written overnight 2026-10-09/10 by Claude for Brian Sheppard, from a web
and PDF search of about thirty sources (listed at the end). Everything marked *not read*
was seen only as an abstract or a citation. Nothing here has been checked by a
mathematician. Companion pictures: `ulam-workbench/renders/literature-classes/` (not in
this repo).

The question was: instead of rendering the whole OEIS, which classes of sequences does
the literature single out, and what rendering shows each class's known property?

## 1. The identity that connects the drawings to a 50-year-old subject

Our rule turns by `angle*(a(n) mod m) + offset` at every unit step. The heading after
step n is therefore the running total of the bends, and the position is the sum of unit
vectors at those headings. With angle = 360/m and offset 0 that is, exactly,

    position after N steps  =  sum over n <= N of  exp( 2*pi*i * S(n) / m ),   S(n) = a(1) + ... + a(n).

So the drawing of a sequence a is the polygonal path of the **exponential sum of its
partial sums**, and conversely the path of the exponential sum of any sequence b is our
drawing of its first differences. The literature calls these paths "graphs of
exponential sums" (Loxton 1983), "curlicues" (Dekking and Mendès France 1981, Berry and
Goldberg 1988) and, since 2016, "Kloosterman paths", "Legendre paths" and "Gauss
paths" (Kowalski and Sawin; Hussain and Lamzouri; Dell and Milićević 2025).

Three consequences for the thread's pictures:

- **The polygonal numbers are complete rational Weyl sums one degree up.** Squares with
  angle 1 and modulus 360 give S(n) = square pyramidal numbers, a cubic; triangular give
  tetrahedral. A Weyl sum with rational coefficients is periodic, which is why the
  figures close, and the fold-count theorem (`docs/fold-count-proof.md`) is the closure
  law of that complete sum. This is the subject Allouche was pointing at when he cited
  Dekking–Mendès France and Deshouillers in the thread (`docs/seqfan-ncurve-thread.md`,
  message 7).
- **Lehmer's incomplete Gauss sums are our drawing of the odd numbers.** Sum of
  exp(2*pi*i*n^2/q) has first differences 2n-1, so A005408 with modulus q and angle 360/q
  draws it. Lehmer (1976) proved these always have the spiral shape; the contact sheet
  reproduces it (panel 4).
- **The curlicue literature is our drawing of a(n) = n at an irrational angle.** With
  modulus larger than every term, angle 360*tau draws the theta sum with phase
  tau*n(n+1)/2. Berry and Goldberg's renormalisation says the picture at tau is, up to
  scale and rotation, the picture at the next continued-fraction remainder of tau:
  deleting the first partial quotient removes the finest level of curls. Saha's summary:
  a curlicue "turns a number inside out". Hardy–Littlewood bounds the path by C*sqrt(N)
  for badly approximable tau.

## 2. The lineage, in two strands

**Exponential-sum strand (number theory).** Lehmer 1976 (incomplete Gauss sums, spiral
shape). Dekking and Mendès France 1981 (curves of real sequences; a dimension defined by
fattening the curve by epsilon and measuring the area inside a disc of radius R; a
curve is "superficial" if that dimension exceeds 1; a theorem relating uniform
distribution mod 1 to the curve spreading over the plane, which Moore and van der
Poorten say the "final blobs" of their pictures obey; *the 1981 paper itself not
read*). Loxton 1983 (graphs of exponential sums with phase t*sqrt(n)). Deshouillers
1985 (*Geometric aspect of Weyl sums*; scanned PDF, no extractable text; Moore and van
der Poorten say one of its curves "virtually shouts a theorem waiting to be proved").
Berry and Goldberg 1988 (renormalisation of curlicues via continued fractions). Moore
and van der Poorten 1989 (survey; the "Loch Ness monster" with phase (log h)^4;
Mendès France's temperature and entropy of curves). Cellarosi 2011 and
Cellarosi–Marklof 2016 (limit laws for theta-sum paths). Kowalski and Sawin 2016
(Kloosterman paths converge to an explicit random Fourier series). Dell and
Milićević, August 2025 (*The shape of quadratic Gauss paths*: the paths for square-free
moduli converge in law; the limiting shapes form an atlas indexed by the Legendre
symbols of c at the first few primes; 18 shapes for primes up to 5; cusps at a dense
set of rationals when two of those symbols are -1).

**Turtle strand (combinatorics on words).** Odds 1962/1973 and Krawczyk (spirolaterals:
turn by a fixed angle, step lengths 1..n repeated; closes when the total turn is a
multiple of 360 unless one pass already totals 360). Abelson and diSessa 1980 (total
turning of a closed turtle path is a multiple of 2*pi; OEIS A261790 is the Logo
turtle's return-to-orientation table for 360). Davis and Knuth 1970, Dekking–Mendès
France–van der Poorten *Folds!* 1982, Dekking 2012 (which paperfolding curves are
self-avoiding or plane-filling; a complete geometric classification). Ma and Holdener
2005 (Thue–Morse turtle curves converge to the Koch snowflake). Allouche and Skordev
2007 (that convergence was already in Coquet 1983 and Dekking 1982 as a statement about
complex sums). Karhumäki and Puzynina 2011 (Fibonacci-word pictures: a computable
criterion for boundedness). Mitchell, Bridges 2013 (*Spirolateral-type images from
integer sequences*: the thread's idea, with digit sums A007953 and A000120, Kolakoski
A000002 and the Fibonacci word as turn multipliers; four pages, no theorems). Zantema
2016 (*Turtle graphics of morphic sequences*: Theorem 3, a word that factors into blocks
each of zero net turn and zero displacement gives a finite curve; Theorem 4, Thue–Morse
is finite whenever the two angles sum to k*pi/2^n with k odd; Theorem 7, a morphism
that scales every symbol's displacement by the same similarity gives a self-similar
curve; Theorem 11, with bends 60 and 180 the midpoints of every fourth Thue–Morse
segment are exactly the Koch curve scaled by 3/2; section 8, curves that cover every
grid edge of a quadrant exactly once). Schaumann 2024 (confirms Zantema's conjecture on
when Thue–Morse turtle curves converge to Koch, via Dekking's sums). Drmota, Mauduit
and Rivat 2019 (Thue–Morse along the squares is normal); Mauduit and Rivat 2010
(Thue–Morse along the primes is equidistributed); Spiegelhofer 2023 (along the cubes;
*not read*).

**Walk strand (visual, little theory).** Aragón Artacho, Bailey, Borwein and Borwein
2013 (*Walking on real numbers*: base-4 digit walks of pi, e, sqrt 2, with a
108-gigapixel picture of 100 billion digits of pi; normality as the working definition
of randomness). Colonna (2D and 3D lattice walks of the Liouville function). Wolfram
Demonstrations (prime walks in 2D and 3D, Gauss-sum walks, curlicue renormalisation).
John D. Cook (exponential-sum pictures with cubic phases; prime walks). Harriss
(Collatz seaweed, turning left on halving and right on tripling). Pressey (Kolakoski
Kurve: 1 forward, 2 turn right).

**What I did not find.** No paper on turning walks in three dimensions driven by a
sequence: the only 3D walks are lattice walks (Colonna, Wolfram). So the ring-or-helix
draft (`docs/ring-or-helix.md`) is not answering a question anyone has asked in print,
as far as tonight's search reached. Searches were in English only; Dekking–Mendès
France, Deshouillers and Mendès France 1983 are partly in French and I did not read
them. OEIS: the word "turtle" occurs in 26 entries, six of them actual drawing rules
(A233399, A298952, A391614, A143668, A363348, A363445); neither 1981 nor 1985 reference
appears to be linked from the polygonal-number entries. That is the thread's open item
4 and a submission Brian could make.

## 3. Does the arc rule keep the literature's pictures?

The literature draws unit segments; we draw unit arcs. The sheets
`classes-arcs.png` and `classes-segments.png` draw thirteen panels from the same bend
sequences both ways (3,000 terms, bends reduced to (-180, 180], tilt zero). Every
panel keeps its character: the arc versions are rounded copies of the segment versions.
Two things had to be fixed to get there, and both matter for any rendering outside the
thread's `mod 360, -180` setting:

- **Bends must be signed.** An arc that bends 270 degrees is a backwards coil, not a
  right turn; the segment turtle does not care. Any rule whose bends can exceed 180
  (angle 360/q on residues, digits times 36) needs the signed residue.
- **The tilt must be set to zero explicitly** in `film_vec.conics`, whose default is the
  next-digit rule; it silently lifted the panels whose terms exceed the modulus.

## 4. Classes to highlight, and the rendering that shows each class's property

Settings below are `angle, modulus, offset` in the project's rule; "bends" lists the
signed bend per symbol for 0/1 sequences.

**A. Polynomial sequences at a rational angle (the thread's class).** Polygonal
numbers A000217 A000290 A000326 A000384 A000566 A000567, oblong A002378, A028724,
cubes A000578, pyramidal numbers, and any sequence periodic mod m, which includes every
linear recurrence (Fibonacci A000045 mod 360 has the Pisano period). Known: complete
rational Weyl sums are periodic; closure and fold count (A400844); the 3D ring-or-helix
split for the tilted versions. Rendering: the one-copy flat trace and the mod-7 ring or
helix, which is what the panels job on jaga is producing. Nothing more is needed here
except the panels.

**B. The same sequences at an irrational angle: curlicues.** a(n) = n (A000027) or
the odd numbers A005408 with modulus above every term and angle 360*tau for tau =
(sqrt5-1)/2, sqrt2-1, e-2, pi-3, and tau = 1/7, 2/15 as rational foils. Known:
Berry–Goldberg renormalisation (each continued-fraction digit is one scale of curl);
Hardy–Littlewood sqrt(N) bound for badly approximable tau; Cellarosi's limit law.
Rendering: an **angle sweep**, time = tau sliding across an interval, flat view, N
fixed at a few thousand. The thread's open item 2 was that nobody has swept a
parameter; this is the sweep with a theorem behind it, and the moment tau crosses a
rational with small denominator the picture snaps into a closed figure and out again.
The sheet shows golden ratio and sqrt 2 as fractal trees and pi-3 (close to 1/7) as a
seven-fold spiral of blobs.

**C. Automatic and morphic 0/1 sequences.** Thue–Morse A010060 (bends 60/180: the
Koch relationship), period-doubling A096268 (Zantema: the same Koch curve shifted by
one symbol), regular paperfolding A014577 (bends -90/+90: Heighway dragon),
Rudin–Shapiro A020985 (90-degree bends fill one eighth of the plane's grid edges),
Fibonacci word A003849 (bends 0/90: fills a quadrant's grid edges exactly once), and
Kolakoski A000002 (1 straight, 2 turn 90; not morphic, and whether 1 and 2 have
density 1/2 is open). Known: Zantema's criteria decide finite vs self-similar from the
angles. Rendering: a flat trace with the **camera zooming out as terms arrive**, so
the self-similarity (a copy of the whole appears at scale c every morphism step) is
the visible event. Our existing 3D tilt rules do nothing for these sequences (every
term is below the modulus), so a 3D version needs a new rule; the natural one from the
paperfolding literature is **alternate folding**: odd steps bend in the plane, even
steps pitch out of it, which is how a strip folded in 3D is coded. Dekking's
classification would say which of those are self-avoiding.

**D. The same automatic sequence along polynomial subsequences.** Thue–Morse at n,
at n^2 (normal: Drmota–Mauduit–Rivat), at p_n (equidistributed: Mauduit–Rivat), at
n^3 (Spiegelhofer), all with bends 60/180. Rendering: a **triptych** in one frame,
same rule, same term count: a Koch curve, a random walk on the honeycomb lattice, and
the primes in between. The sheet has the first two (panels 5 and 6) and the contrast is
immediate. This is the single clearest "a picture shows a theorem" that the search
turned up, and it is cheap.

**E. Arithmetic plus-minus-one and character sequences.** Liouville A008836 and
Möbius A008683 (bends +90/-90 by sign: the heading is 90 times Pólya's or Mertens's
summatory function, so the sqrt(N) envelope and its known violations are the story),
primes mod 4 (A000040 with angle 90, modulus 4: Chebyshev's bias is a drift), Legendre
symbols mod p for several p (Hussain–Lamzouri's Legendre paths), and the first
differences of the quadratic Gauss paths of Dell–Milićević, whose 18-shape atlas we can
draw directly by choosing moduli with prescribed symbols at 2, 3, 5. Rendering: flat,
with a **sqrt(N) circle drawn under the walk**, several moduli side by side for the
character paths.

**F. Self-referential sequences (the public group).** Recamán A005132, Van Eck
A181391, Golomb A001462, Hofstadter Q A005185, Stern's diatomic A002487, Kolakoski,
and Beatty sequences such as floor(n*phi) A000201 whose residues are Sturmian. Known:
nothing about their drawings; these are Sloane's favourites and the ones the public
knows. Rendering: the thread's rule plus the next-digit lift; exploratory. Beatty
sequences are the exception with theory: quasi-periodic turn sequences give bounded
or unbounded pictures by a computable criterion (Karhumäki–Puzynina, for the
Fibonacci-word case).

**G. Digits of constants.** pi A000796, e A001113, sqrt 2 A002193 with angle 36,
modulus 10 (the signed version: digits 6..9 turn the other way). Known: Borwein et
al.'s walks; normality unproved for every natural constant. Rendering: flat, next to a
pseudo-random digit stream with the same rule, so the viewer sees that nothing
distinguishes them, which is the point.

## 5. A measured feature instead of a name

The thread's open item 3 was that naming does not scale and a feature vector is the
useful object. The literature already has two features built for exactly these curves:
Mendès France's **temperature**, T = 1 / ln(2L / (2L - h)) with L the curve's length
(N for N unit arcs) and h the perimeter of its convex hull (0 for a segment, 1/ln 2 for
a closed convex curve, large for a tangle that stays in a small hull), and the
Dekking–Mendès France **dimension** from the epsilon-fattened area. The formula for T
is as MathWorld states it; the original is the entropy of the curve's intersections
with random lines (Mendès France 1983, Dupain–Kamae–Mendès France 1986), *not read*.

`ulam-workbench/renders/base360-prototype/temperature.py` computes T for the thread
group. One copy of the figure where it repeats:

| sequence | terms | hull perimeter | T |
|---|---|---|---|
| A001571 | 201 | 148.8 | 2.16 |
| French curve A000376 | 20 | 11.0 | 3.12 |
| Zipper A039685 | 36 | 18.5 | 3.36 |
| Saw blade A001553 | 201 | 72.6 | 5.02 |
| Pentagonal A000326 | 720 | 124.8 | 11.03 |
| Pie crust A000464 | 216 | 35.6 | 11.61 |
| Octagonal A000567 | 720 | 113.0 | 12.23 |
| Squares A000290 | 2,160 | 338.2 | 12.27 |
| A028724 | 1,440 | 212.4 | 13.06 |
| Propeller A000828 | 201 | 26.1 | 14.89 |
| Hexagonal A000384 | 2,160 | 225.7 | 18.64 |
| Heptagonal A000566 | 2,160 | 171.7 | 24.66 |
| A001603 | 120 | 9.0 | 26.08 |
| Triangular A000217 | 2,160 | 155.2 | 27.34 |
| Record disc A039188 | 70 | 4.1 | 33.58 |
| Oblong A002378 | 1,001 | 53.5 | 36.91 |
| Sloane's find A019488 | 201 | 2.1 | 193.4 |
| A006694 | 10,001 | 77.3 | 258.3 |
| A081844 | 10,001 | 85.3 | 234.1 |
| Tire A001051 | 10,000 | 3.0 | 6,745 |
| Slinky A039970 | 65,537 | 3.3 | 39,900 |

The ordering is sensible: the open, ribbon-like figures are cold, the closed rosettes
warm, and the figures that retrace a tiny flower thousands of times (Tire, Slinky,
Sloane's find) run very hot because the period of their turn sequence is longer than
half the b-file, so no one-copy length was found and the whole retraced b-file was
measured. T is therefore only comparable at equal "one copy" lengths, and the
one-copy search in `panels.py` needs a cheaper method (period of the residues, not of
the whole turn pair) before this scales. With that fixed, T and the dimension for
every OEIS entry with a b-file is a small batch job on jaga, and clustering on those
two numbers plus the fold count and the ring-or-helix slide is how to pick which
sequences to render, rather than rendering them all.

## 6. Suggested order of work

1. Class D triptych (Thue–Morse at n, n^2, p_n): one flat clip, three figures, under an
   hour on jaga.
2. Class B angle sweep of a(n) = n across tau in [0.13, 0.15] through 1/7: one flat
   clip where time is the angle.
3. Class E: Liouville and primes mod 4 with the sqrt(N) circle; the Dell–Milićević
   atlas as 18 small panels.
4. Class C in 3D with the alternate-fold rule, after writing it and checking what
   Dekking's classification predicts.
5. The temperature and dimension batch over the OEIS, then choose representatives.

## Sources

- F. M. Dekking, M. Mendès France, Uniform distribution modulo one: a geometrical viewpoint, J. reine angew. Math. 329 (1981) 143–153. *Not read*; described via Moore–van der Poorten.
- J.-M. Deshouillers, Geometric aspect of Weyl sums, Banach Center Publ. 17 (1985) 75–82. https://bibliotekanauki.pl/articles/721340.pdf (scan).
- D. H. Lehmer, Incomplete Gauss sums, Mathematika 23 (1976) 125–135.
- J. H. Loxton, The graphs of exponential sums, Mathematika 30 (1983) 153–163.
- M. V. Berry, J. Goldberg, Renormalisation of curlicues, Nonlinearity 1 (1988) 1–26.
- R. R. Moore, A. J. van der Poorten, On the thermodynamics of curves and other curlicues, Proc. CMA 22 (1989). https://maths.anu.edu.au/files/CMAProcVol22-MoorePoorten.pdf
- M. Mendès France, Entropie, dimension et thermodynamique des courbes planes (1983). https://www.numdam.org/item/SPHM_1983___5_A1_0/ *Not read.*
- F. Cellarosi, Limiting curlicue measures for theta sums (2011). https://arxiv.org/abs/0905.1092
- E. Kowalski, W. Sawin, Kloosterman paths and the shape of exponential sums, Compositio 152 (2016). https://arxiv.org/abs/1410.7892
- J. Dell, D. Milićević, The shape of quadratic Gauss paths (2025). https://arxiv.org/abs/2508.21707
- P. Saha, Curlicues. https://www.physik.uzh.ch/~psaha/misc/curlicues/
- H. Abelson, A. diSessa, Turtle Geometry (1980); R. J. Krawczyk, spirolateral notes, https://www.mi.sanu.ac.rs/vismath/krawczyk/spdesc02.htm ; Wikipedia, Spirolateral.
- F. M. Dekking, Paperfolding morphisms, planefilling curves, and fractal tiles (2012). https://arxiv.org/abs/1011.5788
- J. Ma, J. Holdener, When Thue–Morse meets Koch, Fractals 13 (2005). Described via Schaumann and Zantema.
- H. Zantema, Turtle graphics of morphic sequences, Fractals 24 (2016). https://hzantema.win.tue.nl/turtle.pdf (read in full).
- L. Schaumann, Generalized results on the convergence of Thue–Morse turtle curves (2024). https://arxiv.org/abs/2412.06183
- J. Karhumäki, S. Puzynina, Locally catenative sequences and Turtle graphics, RAIRO ITA 45 (2011). https://www.numdam.org/item/ITA_2011__45_3_311_0/ (abstract only).
- K. Mitchell, Spirolateral-type images from integer sequences, Bridges 2013, 403–406. https://archive.bridgesmathart.org/2013/bridges2013-403.html (read in full).
- M. Drmota, C. Mauduit, J. Rivat, The Thue–Morse sequence along squares is normal. https://www.dmg.tuwien.ac.at/drmota/alongsquares.pdf
- L. Spiegelhofer, Thue–Morse along the sequence of cubes (2023). arXiv:2308.09498. *Not read.*
- F. J. Aragón Artacho, D. H. Bailey, J. M. Borwein, P. B. Borwein, Walking on real numbers, Math. Intelligencer 35 (2013). https://www.davidhbailey.com/dhbpapers/tools-walk.pdf
- J.-F. Colonna, Liouville function as 2D and 3D random walks. https://www.lactamme.polytechnique.fr/images/PRIM.A1.D/display.html
- E. Harriss, Collatz seaweed. https://edmund.mathematicians.org.uk/projects/collatz-seaweed/
- C. Pressey, Kolakoski Kurve. https://git.catseye.tc/Kolakoski-Kurve/
- J. D. Cook, Exponential sums make pretty pictures. https://www.johndcook.com/blog/2017/10/07/exponential-sums-make-pretty-pictures/
- OEIS: A233399 (turtle transform of the primes), A261790 (Logo turtle return table), A363348, A363445, A298952, A391614, A143668.
- MathWorld, Temperature (of a curve). https://mathworld.wolfram.com/Temperature.html
