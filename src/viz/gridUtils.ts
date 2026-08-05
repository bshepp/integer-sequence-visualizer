export function spiralCoord(i: number): { x: number; y: number } {
  // Walk the spiral: direction cycle R,U,L,D with run lengths 1,1,2,2,3,3,…
  let x = 0, y = 0;
  let dir = 0; // 0=R 1=U 2=L 3=D
  let run = 1, stepsInRun = 0, runsAtThisLength = 0;
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  for (let n = 0; n < i; n++) {
    x += dx[dir]!;
    y += dy[dir]!;
    stepsInRun++;
    if (stepsInRun === run) {
      stepsInRun = 0;
      dir = (dir + 1) % 4;
      runsAtThisLength++;
      if (runsAtThisLength === 2) { runsAtThisLength = 0; run++; }
    }
  }
  return { x, y };
}
