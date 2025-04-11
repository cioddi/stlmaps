export interface City {
  name: string;
  country: string;
  coordinates: [number, number]; // [longitude, latitude]
  population: number;
}

const cities: City[] = [
  { name: "New York", country: "USA", coordinates: [-74.006, 40.7128], population: 8804190 },
  { name: "London", country: "UK", coordinates: [-0.1276, 51.5074], population: 8982000 },
  { name: "Tokyo", country: "Japan", coordinates: [139.6503, 35.6762], population: 13960000 },
  { name: "Paris", country: "France", coordinates: [2.3522, 48.8566], population: 2161000 },
  { name: "Sydney", country: "Australia", coordinates: [151.2093, -33.8688], population: 5312000 },
  { name: "Berlin", country: "Germany", coordinates: [13.4050, 52.5200], population: 3769000 },
  { name: "Rome", country: "Italy", coordinates: [12.4964, 41.9028], population: 2873000 },
  { name: "Cairo", country: "Egypt", coordinates: [31.2357, 30.0444], population: 9540000 },
  { name: "Rio de Janeiro", country: "Brazil", coordinates: [-43.1729, -22.9068], population: 6748000 },
  { name: "Mexico City", country: "Mexico", coordinates: [-99.1332, 19.4326], population: 9209944 },
  { name: "Moscow", country: "Russia", coordinates: [37.6173, 55.7558], population: 12538000 },
  { name: "Beijing", country: "China", coordinates: [116.4074, 39.9042], population: 21540000 },
  { name: "Mumbai", country: "India", coordinates: [72.8777, 19.0760], population: 12478447 },
  { name: "Istanbul", country: "Turkey", coordinates: [28.9784, 41.0082], population: 15460000 },
  { name: "Dubai", country: "UAE", coordinates: [55.2708, 25.2048], population: 3331000 },
  { name: "Singapore", country: "Singapore", coordinates: [103.8198, 1.3521], population: 5686000 },
  { name: "Barcelona", country: "Spain", coordinates: [2.1734, 41.3851], population: 1620000 },
  { name: "Amsterdam", country: "Netherlands", coordinates: [4.9041, 52.3676], population: 821752 },
  { name: "Bangkok", country: "Thailand", coordinates: [100.5018, 13.7563], population: 8281000 },
  { name: "Toronto", country: "Canada", coordinates: [-79.3832, 43.6532], population: 2930000 },
  { name: "Seoul", country: "South Korea", coordinates: [126.9780, 37.5665], population: 9776000 },
  { name: "Cape Town", country: "South Africa", coordinates: [18.4241, -33.9249], population: 433688 },
  { name: "Buenos Aires", country: "Argentina", coordinates: [-58.3816, -34.6037], population: 3075646 },
  { name: "Vienna", country: "Austria", coordinates: [16.3738, 48.2082], population: 1897000 },
  { name: "Stockholm", country: "Sweden", coordinates: [18.0686, 59.3293], population: 975551 },
  { name: "Warsaw", country: "Poland", coordinates: [21.0122, 52.2297], population: 1790658 },
  { name: "Prague", country: "Czech Republic", coordinates: [14.4378, 50.0755], population: 1309000 },
  { name: "Athens", country: "Greece", coordinates: [23.7275, 37.9838], population: 664046 },
  { name: "Helsinki", country: "Finland", coordinates: [24.9384, 60.1699], population: 653835 },
  { name: "Dublin", country: "Ireland", coordinates: [-6.2603, 53.3498], population: 544107 },
  { name: "Lisbon", country: "Portugal", coordinates: [-9.1393, 38.7223], population: 505526 },
  { name: "Brussels", country: "Belgium", coordinates: [4.3517, 50.8503], population: 1208542 },
  { name: "Copenhagen", country: "Denmark", coordinates: [12.5683, 55.6761], population: 602481 },
  { name: "Oslo", country: "Norway", coordinates: [10.7522, 59.9139], population: 693491 },
  { name: "Zurich", country: "Switzerland", coordinates: [8.5417, 47.3769], population: 428737 },
  { name: "Auckland", country: "New Zealand", coordinates: [174.7633, -36.8485], population: 1657000 },
  { name: "Santiago", country: "Chile", coordinates: [-70.6693, -33.4489], population: 6257516 },
  { name: "Reykjavik", country: "Iceland", coordinates: [-21.9426, 64.1466], population: 123246 },
  { name: "Johannesburg", country: "South Africa", coordinates: [28.0473, -26.2041], population: 5635127 },
  { name: "Manila", country: "Philippines", coordinates: [120.9842, 14.5995], population: 1780148 },
  // 60 additional cities
  { name: "San Francisco", country: "USA", coordinates: [-122.4194, 37.7749], population: 873965 },
  { name: "Chicago", country: "USA", coordinates: [-87.6298, 41.8781], population: 2746388 },
  { name: "Los Angeles", country: "USA", coordinates: [-118.2437, 34.0522], population: 3898747 },
  { name: "Miami", country: "USA", coordinates: [-80.1918, 25.7617], population: 454279 },
  { name: "Seattle", country: "USA", coordinates: [-122.3321, 47.6062], population: 737015 },
  { name: "Boston", country: "USA", coordinates: [-71.0589, 42.3601], population: 684379 },
  { name: "Washington DC", country: "USA", coordinates: [-77.0369, 38.9072], population: 701974 },
  { name: "Vancouver", country: "Canada", coordinates: [-123.1207, 49.2827], population: 675218 },
  { name: "Montreal", country: "Canada", coordinates: [-73.5674, 45.5019], population: 1704694 },
  { name: "Calgary", country: "Canada", coordinates: [-114.0719, 51.0447], population: 1336000 },
  { name: "Manchester", country: "UK", coordinates: [-2.2426, 53.4808], population: 547627 },
  { name: "Liverpool", country: "UK", coordinates: [-2.9916, 53.4084], population: 498042 },
  { name: "Glasgow", country: "UK", coordinates: [-4.2518, 55.8642], population: 633120 },
  { name: "Edinburgh", country: "UK", coordinates: [-3.1883, 55.9533], population: 488050 },
  { name: "Birmingham", country: "UK", coordinates: [-1.8904, 52.4862], population: 1141816 },
  { name: "Madrid", country: "Spain", coordinates: [-3.7038, 40.4168], population: 3223334 },
  { name: "Valencia", country: "Spain", coordinates: [-0.3763, 39.4699], population: 791413 },
  { name: "Seville", country: "Spain", coordinates: [-5.9845, 37.3891], population: 688711 },
  { name: "Milan", country: "Italy", coordinates: [9.1900, 45.4642], population: 1352000 },
  { name: "Naples", country: "Italy", coordinates: [14.2681, 40.8518], population: 3085000 },
  { name: "Florence", country: "Italy", coordinates: [11.2558, 43.7696], population: 382258 },
  { name: "Venice", country: "Italy", coordinates: [12.3155, 45.4408], population: 261905 },
  { name: "Munich", country: "Germany", coordinates: [11.5820, 48.1351], population: 1471508 },
  { name: "Hamburg", country: "Germany", coordinates: [9.9937, 53.5511], population: 1841179 },
  { name: "Frankfurt", country: "Germany", coordinates: [8.6821, 50.1109], population: 753056 },
  { name: "Lyon", country: "France", coordinates: [4.8357, 45.7640], population: 513275 },
  { name: "Marseille", country: "France", coordinates: [5.3698, 43.2965], population: 861635 },
  { name: "Nice", country: "France", coordinates: [7.2620, 43.7102], population: 342295 },
  { name: "Shanghai", country: "China", coordinates: [121.4737, 31.2304], population: 24256800 },
  { name: "Guangzhou", country: "China", coordinates: [113.2644, 23.1291], population: 13080500 },
  { name: "Shenzhen", country: "China", coordinates: [114.0579, 22.5431], population: 12590000 },
  { name: "Hong Kong", country: "China", coordinates: [114.1694, 22.3193], population: 7448900 },
  { name: "Delhi", country: "India", coordinates: [77.1025, 28.7041], population: 16787941 },
  { name: "Kolkata", country: "India", coordinates: [88.3639, 22.5726], population: 14112536 },
  { name: "Bangalore", country: "India", coordinates: [77.5946, 12.9716], population: 8443675 },
  { name: "Chennai", country: "India", coordinates: [80.2707, 13.0827], population: 4646732 },
  { name: "Osaka", country: "Japan", coordinates: [135.5023, 34.6937], population: 2691742 },
  { name: "Kyoto", country: "Japan", coordinates: [135.7681, 35.0116], population: 1474570 },
  { name: "Nagoya", country: "Japan", coordinates: [136.9066, 35.1815], population: 2296014 },
  { name: "Sapporo", country: "Japan", coordinates: [141.3545, 43.0621], population: 1952356 },
  { name: "Melbourne", country: "Australia", coordinates: [144.9631, -37.8136], population: 4936349 },
  { name: "Brisbane", country: "Australia", coordinates: [153.0251, -27.4698], population: 2462637 },
  { name: "Perth", country: "Australia", coordinates: [115.8575, -31.9505], population: 2042000 },
  { name: "Adelaide", country: "Australia", coordinates: [138.6007, -34.9285], population: 1345777 },
  { name: "Wellington", country: "New Zealand", coordinates: [174.7762, -41.2865], population: 412500 },
  { name: "Christchurch", country: "New Zealand", coordinates: [172.6362, -43.5320], population: 381800 },
  { name: "São Paulo", country: "Brazil", coordinates: [-46.6333, -23.5505], population: 12106920 },
  { name: "Brasília", country: "Brazil", coordinates: [-47.9292, -15.7801], population: 3015268 },
  { name: "Salvador", country: "Brazil", coordinates: [-38.5014, -12.9716], population: 2886698 },
  { name: "Bogotá", country: "Colombia", coordinates: [-74.0721, 4.7110], population: 7181000 },
  { name: "Lima", country: "Peru", coordinates: [-77.0428, -12.0464], population: 8852000 },
  { name: "Casablanca", country: "Morocco", coordinates: [-7.5898, 33.5731], population: 3359818 },
  { name: "Nairobi", country: "Kenya", coordinates: [36.8219, -1.2921], population: 4397073 },
  { name: "Lagos", country: "Nigeria", coordinates: [3.3792, 6.5244], population: 14862000 },
  { name: "Accra", country: "Ghana", coordinates: [-0.1870, 5.6037], population: 2291352 },
  { name: "Addis Ababa", country: "Ethiopia", coordinates: [38.7578, 9.0222], population: 3384569 },
  { name: "Alexandria", country: "Egypt", coordinates: [29.9187, 31.2001], population: 5200000 },
  { name: "Riyadh", country: "Saudi Arabia", coordinates: [46.6753, 24.7136], population: 7676654 },
  { name: "Tehran", country: "Iran", coordinates: [51.3890, 35.6892], population: 8693706 },
  { name: "Karachi", country: "Pakistan", coordinates: [67.0099, 24.8607], population: 14910352 },
  
  // 100 European cities
  { name: "Rotterdam", country: "Netherlands", coordinates: [4.4777, 51.9244], population: 651446 },
  { name: "Utrecht", country: "Netherlands", coordinates: [5.1214, 52.0907], population: 357597 },
  { name: "Eindhoven", country: "Netherlands", coordinates: [5.4697, 51.4416], population: 234394 },
  { name: "Antwerp", country: "Belgium", coordinates: [4.4024, 51.2194], population: 523248 },
  { name: "Ghent", country: "Belgium", coordinates: [3.7174, 51.0543], population: 263927 },
  { name: "Charleroi", country: "Belgium", coordinates: [4.4435, 50.4108], population: 201300 },
  { name: "Luxembourg City", country: "Luxembourg", coordinates: [6.1296, 49.6116], population: 119214 },
  { name: "Strasbourg", country: "France", coordinates: [7.7521, 48.5734], population: 280966 },
  { name: "Bordeaux", country: "France", coordinates: [-0.5792, 44.8378], population: 257068 },
  { name: "Toulouse", country: "France", coordinates: [1.4442, 43.6047], population: 479553 },
  { name: "Lille", country: "France", coordinates: [3.0573, 50.6292], population: 232741 },
  { name: "Nantes", country: "France", coordinates: [-1.5534, 47.2184], population: 309346 },
  { name: "Montpellier", country: "France", coordinates: [3.8767, 43.6108], population: 285121 },
  { name: "Porto", country: "Portugal", coordinates: [-8.6291, 41.1579], population: 237591 },
  { name: "Braga", country: "Portugal", coordinates: [-8.4266, 41.5518], population: 136885 },
  { name: "Coimbra", country: "Portugal", coordinates: [-8.4293, 40.2033], population: 143396 },
  { name: "Bilbao", country: "Spain", coordinates: [-2.9350, 43.2630], population: 345821 },
  { name: "Zaragoza", country: "Spain", coordinates: [-0.8890, 41.6488], population: 674997 },
  { name: "Málaga", country: "Spain", coordinates: [-4.4214, 36.7213], population: 574654 },
  { name: "Palma", country: "Spain", coordinates: [2.6502, 39.5696], population: 416065 },
  { name: "Granada", country: "Spain", coordinates: [-3.5986, 37.1773], population: 232462 },
  { name: "Genoa", country: "Italy", coordinates: [8.9463, 44.4056], population: 580097 },
  { name: "Turin", country: "Italy", coordinates: [7.6869, 45.0703], population: 870456 },
  { name: "Bologna", country: "Italy", coordinates: [11.3426, 44.4949], population: 390636 },
  { name: "Palermo", country: "Italy", coordinates: [13.3613, 38.1157], population: 663401 },
  { name: "Catania", country: "Italy", coordinates: [15.0878, 37.5079], population: 311584 },
  { name: "Bari", country: "Italy", coordinates: [16.8718, 41.1171], population: 320862 },
  { name: "Basel", country: "Switzerland", coordinates: [7.5886, 47.5596], population: 177654 },
  { name: "Geneva", country: "Switzerland", coordinates: [6.1432, 46.2044], population: 203856 },
  { name: "Lausanne", country: "Switzerland", coordinates: [6.6327, 46.5197], population: 139111 },
  { name: "Bern", country: "Switzerland", coordinates: [7.4474, 46.9480], population: 134591 },
  { name: "Salzburg", country: "Austria", coordinates: [13.0550, 47.8095], population: 155021 },
  { name: "Innsbruck", country: "Austria", coordinates: [11.4041, 47.2692], population: 132493 },
  { name: "Graz", country: "Austria", coordinates: [15.4395, 47.0707], population: 291134 },
  { name: "Linz", country: "Austria", coordinates: [14.2856, 48.3069], population: 204846 },
  { name: "Ljubljana", country: "Slovenia", coordinates: [14.5057, 46.0569], population: 289518 },
  { name: "Zagreb", country: "Croatia", coordinates: [15.9819, 45.8150], population: 806341 },
  { name: "Split", country: "Croatia", coordinates: [16.4402, 43.5081], population: 178102 },
  { name: "Dubrovnik", country: "Croatia", coordinates: [18.0944, 42.6507], population: 42615 },
  { name: "Belgrade", country: "Serbia", coordinates: [20.4651, 44.8125], population: 1378682 },
  { name: "Novi Sad", country: "Serbia", coordinates: [19.8335, 45.2671], population: 289128 },
  { name: "Sarajevo", country: "Bosnia and Herzegovina", coordinates: [18.4131, 43.8563], population: 275524 },
  { name: "Skopje", country: "North Macedonia", coordinates: [21.4317, 41.9973], population: 544086 },
  { name: "Sofia", country: "Bulgaria", coordinates: [23.3219, 42.6977], population: 1241396 },
  { name: "Plovdiv", country: "Bulgaria", coordinates: [24.7453, 42.1354], population: 346893 },
  { name: "Varna", country: "Bulgaria", coordinates: [27.9147, 43.2141], population: 335177 },
  { name: "Bucharest", country: "Romania", coordinates: [26.1025, 44.4268], population: 1803425 },
  { name: "Cluj-Napoca", country: "Romania", coordinates: [23.6236, 46.7712], population: 324576 },
  { name: "Timișoara", country: "Romania", coordinates: [21.2287, 45.7489], population: 319279 },
  { name: "Budapest", country: "Hungary", coordinates: [19.0402, 47.4979], population: 1752286 },
  { name: "Debrecen", country: "Hungary", coordinates: [21.6270, 47.5316], population: 201982 },
  { name: "Szeged", country: "Hungary", coordinates: [20.1486, 46.2530], population: 160766 },
  { name: "Bratislava", country: "Slovakia", coordinates: [17.1077, 48.1486], population: 429564 },
  { name: "Košice", country: "Slovakia", coordinates: [21.2611, 48.7164], population: 238593 },
  { name: "Kraków", country: "Poland", coordinates: [19.9450, 50.0647], population: 780981 },
  { name: "Wrocław", country: "Poland", coordinates: [17.0385, 51.1079], population: 643782 },
  { name: "Gdańsk", country: "Poland", coordinates: [18.6466, 54.3520], population: 470907 },
  { name: "Poznań", country: "Poland", coordinates: [16.9252, 52.4064], population: 532048 },
  { name: "Łódź", country: "Poland", coordinates: [19.4560, 51.7592], population: 679941 },
  { name: "Kiev", country: "Ukraine", coordinates: [30.5234, 50.4501], population: 2962180 },
  { name: "Lviv", country: "Ukraine", coordinates: [24.0297, 49.8397], population: 724314 },
  { name: "Odessa", country: "Ukraine", coordinates: [30.7233, 46.4825], population: 1017699 },
  { name: "Kharkiv", country: "Ukraine", coordinates: [36.2304, 49.9935], population: 1446107 },
  { name: "Minsk", country: "Belarus", coordinates: [27.5615, 53.9045], population: 2018281 },
  { name: "Riga", country: "Latvia", coordinates: [24.1052, 56.9496], population: 627487 },
  { name: "Vilnius", country: "Lithuania", coordinates: [25.2797, 54.6872], population: 580020 },
  { name: "Kaunas", country: "Lithuania", coordinates: [23.9036, 54.8985], population: 295269 },
  { name: "Tallinn", country: "Estonia", coordinates: [24.7536, 59.4370], population: 438341 },
  { name: "St. Petersburg", country: "Russia", coordinates: [30.3351, 59.9343], population: 5383890 },
  { name: "Kaliningrad", country: "Russia", coordinates: [20.5037, 54.7065], population: 489359 },
  { name: "Gothenburg", country: "Sweden", coordinates: [11.9746, 57.7089], population: 583056 },
  { name: "Malmö", country: "Sweden", coordinates: [13.0359, 55.6050], population: 344166 },
  { name: "Uppsala", country: "Sweden", coordinates: [17.6389, 59.8586], population: 177074 },
  { name: "Bergen", country: "Norway", coordinates: [5.3221, 60.3913], population: 287888 },
  { name: "Trondheim", country: "Norway", coordinates: [10.3951, 63.4305], population: 199039 },
  { name: "Stavanger", country: "Norway", coordinates: [5.7331, 58.9700], population: 143574 },
  { name: "Tampere", country: "Finland", coordinates: [23.7610, 61.4978], population: 238140 },
  { name: "Turku", country: "Finland", coordinates: [22.2685, 60.4518], population: 193224 },
  { name: "Oulu", country: "Finland", coordinates: [25.4715, 65.0126], population: 203940 },
  { name: "Aarhus", country: "Denmark", coordinates: [10.2108, 56.1629], population: 349983 },
  { name: "Odense", country: "Denmark", coordinates: [10.4036, 55.3971], population: 180863 },
  { name: "Aalborg", country: "Denmark", coordinates: [9.9187, 57.0488], population: 140897 },
  { name: "Cork", country: "Ireland", coordinates: [-8.4863, 51.8969], population: 210000 },
  { name: "Galway", country: "Ireland", coordinates: [-9.0574, 53.2707], population: 79934 },
  { name: "Limerick", country: "Ireland", coordinates: [-8.6267, 52.6638], population: 94192 },
  { name: "Bristol", country: "UK", coordinates: [-2.5879, 51.4545], population: 463400 },
  { name: "Newcastle", country: "UK", coordinates: [-1.6132, 54.9783], population: 300196 },
  { name: "Sheffield", country: "UK", coordinates: [-1.4701, 53.3811], population: 582506 },
  { name: "Leeds", country: "UK", coordinates: [-1.5491, 53.8008], population: 792525 },
  { name: "Cardiff", country: "UK", coordinates: [-3.1791, 51.4816], population: 362756 },
  { name: "Belfast", country: "UK", coordinates: [-5.9301, 54.5973], population: 343542 },
  { name: "Thessaloniki", country: "Greece", coordinates: [22.9444, 40.6401], population: 1012297 },
  { name: "Patras", country: "Greece", coordinates: [21.7369, 38.2466], population: 213984 },
  { name: "Heraklion", country: "Greece", coordinates: [25.1442, 35.3387], population: 173993 },
  { name: "Nicosia", country: "Cyprus", coordinates: [33.3823, 35.1856], population: 330000 },
  { name: "Limassol", country: "Cyprus", coordinates: [33.0413, 34.6786], population: 235056 },
  { name: "Valletta", country: "Malta", coordinates: [14.5074, 35.8989], population: 5827 }
];

export default cities;
