export function CampusArt() {
  const trees = [
    [95, 137, 24],
    [152, 98, 28],
    [228, 135, 20],
    [395, 160, 19],
    [675, 173, 20],
    [904, 130, 28],
    [939, 237, 22],
    [886, 336, 18],
    [123, 355, 24],
    [169, 428, 18],
    [98, 531, 28],
    [919, 521, 25],
    [924, 705, 30],
    [677, 704, 22],
    [382, 713, 20],
    [569, 621, 17],
    [215, 548, 17],
    [401, 293, 16],
    [621, 208, 18],
    [435, 529, 14],
    [611, 538, 16],
    [163, 199, 19],
    [103, 247, 25],
    [863, 744, 20],
    [70, 660, 24],
  ];
  return (
    <g className="campus-art">
      <defs>
        <pattern id="grass" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="5" r=".65" fill="#668471" opacity=".14" />
        </pattern>
        <pattern id="court" width="75" height="48" patternUnits="userSpaceOnUse">
          <rect
            x="5"
            y="5"
            width="64"
            height="38"
            rx="1"
            fill="none"
            stroke="#edf1df"
            strokeWidth="1.3"
          />
          <path d="M37 5v38M5 24h64" stroke="#edf1df" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1000" height="800" className="map-land" />
      <path
        d="M35 55 312 30 391 112 591 93 717 35 965 88 970 730 771 760 650 740 425 777 200 744 43 776Z"
        fill="url(#grass)"
      />
      <path
        d="M75 0 112 97 112 268 70 430 57 610 90 800M978 0 943 132 949 340 991 466M0 751 350 752 493 727 782 762 1000 749"
        className="map-road-border"
      />
      <path
        d="M75 0 112 97 112 268 70 430 57 610 90 800M978 0 943 132 949 340 991 466M0 751 350 752 493 727 782 762 1000 749"
        className="map-road"
      />
      <path
        d="M185 154q-35-89 42-96l101 3q63 5 63 61l-8 45ZM723 602q68-89 164-43l24 107q-77 61-134 17ZM427 331q17-41 63-14l-6 45Z"
        className="map-green"
      />
      <path
        d="M184 82q38-20 70 7t84-2M752 625q28-25 60-9t65 28"
        stroke="#a7b8a0"
        strokeWidth="1.5"
        fill="none"
      />
      <rect
        x="147"
        y="597"
        width="141"
        height="91"
        rx="7"
        fill="#b9c7a7"
        transform="rotate(-7 218 642)"
      />
      <rect
        x="147"
        y="597"
        width="141"
        height="91"
        rx="7"
        fill="url(#court)"
        transform="rotate(-7 218 642)"
      />
      <path
        d="M305 244V397H790V271M312 492V603H824V638M490 702V397M555 293V397M700 397V603M312 492l-7-95M198 644l114-41M490 603l60-83v-51M550 469l5-72"
        className="map-path-border"
      />
      <path
        d="M305 244V397H790V271M312 492V603H824V638M490 702V397M555 293V397M700 397V603M312 492l-7-95M198 644l114-41M490 603l60-83v-51M550 469l5-72"
        className="map-path"
      />
      <ellipse cx="551" cy="468" rx="64" ry="62" className="map-green" />
      <ellipse cx="551" cy="468" rx="42" ry="39" fill="none" stroke="#f5f3e9" strokeWidth="10" />
      <ellipse cx="551" cy="468" rx="15" ry="13" fill="#a0b9b0" stroke="#e4e8da" strokeWidth="4" />
      <g className="map-building">
        <path d="M231 184h145v82h-48v-29h-51v29h-46Z" />
        <path d="M489 212h134v87H489Z" />
        <path d="M503 197h106v25H503Z" />
        <path d="M744 211h112v77h-40v-39h-32v39h-40Z" />
        <rect x="256" y="443" width="108" height="58" rx="5" />
        <rect x="269" y="428" width="81" height="21" rx="2" />
        <path d="M661 449h90v65h-90Z" />
        <path d="M779 601h91v47h-91Z" />
        <path d="M430 666h37v40h-37ZM515 666h37v40h-37Z" />
      </g>
      <g fill="none" className="roof-line">
        <path d="M242 193h122v34h-45m-45 0h-32v30M500 234h112v52H500ZM753 221h93v19M267 455h86v34h-86ZM671 460h69v43h-69ZM791 612h66v25h-66Z" />
        <path d="M515 234v52m15-52v52m15-52v52m15-52v52m15-52v52m15-52v52" opacity=".3" />
      </g>
      <g>
        {trees.map(([x, y, r], i) => (
          <g key={i}>
            <ellipse cx={x + 2} cy={y + 5} rx={r} ry={r * 0.8} fill="#455e3b" opacity=".08" />
            <circle cx={x} cy={y} r={r} className="map-tree" />
            <circle cx={x - 4} cy={y - 4} r={r * 0.63} fill="#d4dfc7" opacity=".55" />
          </g>
        ))}
      </g>
      <g className="map-small-label">
        <text x="582" y="381">
          UNIVERSITY WALK
        </text>
        <text x="106" y="469" transform="rotate(-80 106 469)">
          WEST CAMPUS ROAD
        </text>
        <text x="548" y="573">
          THE GREEN
        </text>
        <text x="767" y="107">
          EAST GARDENS
        </text>
        <text x="183" y="718">
          SPORTS GROUNDS
        </text>
      </g>
      <g stroke="#a8aa91" strokeWidth="3" strokeLinecap="round">
        <path d="M448 434v16m192-24v16m-211 97v16m201 93h16m-219-23h16" />
      </g>
    </g>
  );
}
