/**
 * Geometria do mapa facial (vista frontal), do design system aprovado.
 * Viewbox 853 x 1110: a mesma proporção da ilustração de referência.
 *
 * LATERALIDADE: -dir e -esq seguem a anatomia da cliente, não o lado da tela.
 * De frente para ela, a bochecha direita dela aparece à esquerda de quem olha.
 */
export const FACE_VIEWBOX = { width: 853, height: 1110 } as const;

/** Silhueta de recorte: rosto, orelhas e colo. */
export const FACE_OUTLINE =
  "M427,70 C300,70 175,180 155,400 C140,560 175,700 240,810 C300,905 370,950 427,950 C484,950 554,905 614,810 C679,700 714,560 699,400 C679,180 554,70 427,70 Z";
export const FACE_NECK =
  "M282,880 L572,880 C582,980 588,1045 598,1110 L256,1110 C266,1045 272,980 282,880 Z";
export const FACE_EARS = [
  { cx: 115, cy: 552, rx: 44, ry: 96 },
  { cx: 739, cy: 552, rx: 44, ry: 96 },
] as const;

export type FaceZone = {
  id: string;
  nome: string;
  /** Centroide interno: onde a marcação pousa quando não há ponto escolhido. */
  c?: readonly [number, number] | undefined;
  d: string;
  /** Região-mãe, quando esta é uma microrregião criada dentro dela. */
  mae?: string | null | undefined;
  /** Região do lado oposto, para as criadas no editor. */
  par?: string | undefined;
};

export const FACE_ZONES: FaceZone[] = [
  {
    id: "testa",
    nome: "Testa",
    c: [427, 278],
    d: "M300,205 C360,180 495,180 555,205 C562,280 560,330 552,372 C480,356 375,356 302,372 C294,330 293,280 300,205 Z",
  },
  {
    id: "tempora-esq",
    nome: "Têmpora esquerda",
    c: [621, 307],
    d: "M560,205 C620,215 670,255 692,320 C698,348 697,368 693,388 C649,378 601,374 558,374 C566,318 566,262 560,205 Z",
  },
  {
    id: "tempora-dir",
    nome: "Têmpora direita",
    c: [233, 307],
    d: "M294,205 C234,215 184,255 162,320 C156,348 157,368 161,388 C205,378 253,374 296,374 C288,318 288,262 294,205 Z",
  },
  {
    id: "sobrancelha-dir",
    nome: "Sobrancelha direita",
    c: [262, 419],
    d: "M340,402 C282,386 222,404 176,436 L182,458 C224,424 284,418 342,430 Z",
  },
  {
    id: "sobrancelha-esq",
    nome: "Sobrancelha esquerda",
    c: [590, 419],
    d: "M513,402 C571,386 631,404 677,436 L671,458 C629,424 569,418 511,430 Z",
  },
  {
    id: "glabela",
    nome: "Glabela",
    c: [427, 410],
    d: "M385,385 C405,372 450,372 470,385 C474,412 472,432 468,445 C448,437 406,437 387,445 C382,432 381,412 385,385 Z",
  },
  {
    id: "periorbital-esq",
    nome: "Região periorbital esquerda",
    c: [578, 517],
    d: "M505,480 C545,455 610,450 648,470 C660,500 652,545 630,570 C590,590 535,580 508,552 C498,525 498,498 505,480 Z",
  },
  {
    id: "periorbital-dir",
    nome: "Região periorbital direita",
    c: [276, 517],
    d: "M349,480 C309,455 244,450 206,470 C194,500 202,545 224,570 C264,590 319,580 346,552 C356,525 356,498 349,480 Z",
  },
  {
    id: "nariz",
    nome: "Nariz",
    c: [427, 592],
    d: "M398,420 C415,410 439,410 456,420 C466,500 474,600 490,672 C500,700 490,722 460,728 C440,733 414,733 394,728 C364,722 354,700 364,672 C380,600 388,500 398,420 Z",
  },
  {
    id: "bochecha-esq",
    nome: "Bochecha esquerda",
    c: [614, 646],
    d: "M492,545 C560,525 650,518 706,528 C712,565 706,612 700,655 C672,700 626,760 592,836 C575,880 562,900 556,908 C548,880 552,840 566,800 C580,752 586,700 580,660 C552,632 512,590 492,545 Z",
  },
  {
    id: "bochecha-dir",
    nome: "Bochecha direita",
    c: [240, 645],
    d: "M362,545 C294,525 204,518 148,528 C142,565 148,612 154,655 C182,700 228,760 262,836 C279,880 292,900 298,908 C306,880 302,840 288,800 C274,752 268,700 274,660 C302,632 342,590 362,545 Z",
  },
  {
    id: "nasolabial-esq",
    nome: "Sulco nasolabial esquerdo",
    c: [516, 788],
    d: "M492,700 C512,720 528,760 540,800 C548,830 550,856 546,872 C528,868 514,850 506,820 C496,780 486,740 478,714 Z",
  },
  {
    id: "nasolabial-dir",
    nome: "Sulco nasolabial direito",
    c: [338, 787],
    d: "M362,700 C342,720 326,760 314,800 C306,830 304,856 308,872 C326,868 340,850 348,820 C358,780 368,740 376,714 Z",
  },
  {
    id: "perioral",
    nome: "Região perioral",
    c: [427, 805],
    d: "M340,745 C380,730 474,730 514,745 C528,790 530,830 520,862 C480,880 374,880 334,862 C324,830 326,790 340,745 Z",
  },
  {
    id: "mento",
    nome: "Mento",
    c: [427, 905],
    d: "M356,880 C395,868 459,868 498,880 C500,905 486,930 456,942 C436,949 418,949 398,942 C368,930 354,905 356,880 Z",
  },
  {
    id: "mandibula-esq",
    nome: "Mandíbula esquerda",
    c: [608, 806],
    d: "M694,634 C690,720 660,800 610,860 C575,900 535,930 500,944 C492,918 500,896 520,884 C566,856 610,806 638,744 C654,706 664,672 668,632 Z",
  },
  {
    id: "mandibula-dir",
    nome: "Mandíbula direita",
    c: [246, 806],
    d: "M160,634 C164,720 194,800 244,860 C279,900 319,930 354,944 C362,918 354,896 334,884 C288,856 244,806 216,744 C200,706 190,672 186,632 Z",
  },
  {
    id: "colo",
    nome: "Colo",
    c: [427, 1009],
    d: "M282,905 L572,905 C582,990 588,1045 598,1110 L256,1110 C266,1045 272,990 282,905 Z",
  },
];

/** Regiões que existem em par, para replicar o registro no lado oposto. */
export const FACE_PAIRS: Record<string, string> = {
  "tempora-dir": "tempora-esq",
  "tempora-esq": "tempora-dir",
  "sobrancelha-dir": "sobrancelha-esq",
  "sobrancelha-esq": "sobrancelha-dir",
  "periorbital-dir": "periorbital-esq",
  "periorbital-esq": "periorbital-dir",
  "bochecha-dir": "bochecha-esq",
  "bochecha-esq": "bochecha-dir",
  "nasolabial-dir": "nasolabial-esq",
  "nasolabial-esq": "nasolabial-dir",
  "mandibula-dir": "mandibula-esq",
  "mandibula-esq": "mandibula-dir",
};

export const findZone = (id: string) => FACE_ZONES.find((zone) => zone.id === id) ?? null;
