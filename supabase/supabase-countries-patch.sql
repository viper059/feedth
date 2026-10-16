-- feedTH countries patch: รองรับทวีป/ประเทศทั่วโลก (ตรวจที่เซิร์ฟเวอร์ด้วยกรอบพิกัดประเทศ)
-- รันหลัง fog-patch, รันซ้ำได้ปลอดภัย (ไม่มี DROP/DELETE)
create table if not exists public.countries (
  iso3 text primary key, name text not null, continent text not null,
  min_lng float8 not null, min_lat float8 not null, max_lng float8 not null, max_lat float8 not null
);
alter table public.countries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='countries' and policyname='countries readable') then
    create policy "countries readable" on public.countries for select using (true);
  end if;
end $$;
insert into public.countries (iso3, name, continent, min_lng, min_lat, max_lng, max_lat) values
('ZWE','Zimbabwe','Africa',25.260,-22.400,33.010,-15.640),
('ZMB','Zambia','Africa',21.980,-17.960,33.660,-8.190),
('YEM','Yemen','Asia',42.720,12.620,53.090,19.000),
('VNM','Vietnam','Asia',102.130,8.800,109.300,23.350),
('VEN','Venezuela','South America',-73.360,0.820,-60.020,12.180),
('VAT','Vatican','Europe',12.430,41.900,12.440,41.910),
('VUT','Vanuatu','Oceania',166.630,-15.490,167.200,-14.830),
('UZB','Uzbekistan','Asia',55.980,37.170,72.620,45.560),
('URY','Uruguay','South America',-58.400,-34.930,-53.130,-30.110),
('FSM','Federated States of Micronesia','Oceania',158.130,6.800,158.310,6.950),
('MHL','Marshall Islands','Oceania',171.100,7.070,171.230,7.140),
('MNP','Northern Mariana Islands','Oceania',145.680,15.130,145.780,15.220),
('VIR','United States Virgin Islands','North America',-64.890,17.700,-64.690,17.790),
('GUM','Guam','Oceania',144.650,13.260,144.790,13.530),
('ASM','American Samoa','Oceania',-170.820,-14.350,-170.690,-14.260),
('PRI','Puerto Rico','North America',-67.200,17.970,-65.970,18.500),
('USA','United States of America','North America',-168.090,19.010,-67.110,71.320),
('PCN','Pitcairn Islands','Oceania',-128.350,-24.400,-128.290,-24.330),
('AIA','Anguilla','North America',-63.150,18.200,-63.000,18.270),
('FLK','Falkland Islands','South America',-59.070,-52.170,-57.840,-51.270),
('CYM','Cayman Islands','North America',-81.370,19.270,-81.130,19.360),
('BMU','Bermuda','North America',-64.820,32.260,-64.690,32.390),
('VGB','British Virgin Islands','North America',-64.430,18.460,-64.320,18.520),
('TCA','Turks and Caicos Islands','North America',-71.830,21.770,-71.660,21.850),
('MSR','Montserrat','North America',-62.220,16.680,-62.150,16.750),
('JEY','Jersey','Europe',-2.240,49.180,-2.020,49.270),
('GGY','Guernsey','Europe',-2.650,49.430,-2.510,49.490),
('IMN','Isle of Man','Europe',-4.750,54.120,-4.410,54.380),
('GBR','United Kingdom','Europe',-8.120,50.250,1.660,58.630),
('ARE','United Arab Emirates','Asia',51.570,22.620,56.390,26.060),
('UKR','Ukraine','Europe',22.130,45.230,39.960,52.340),
('UGA','Uganda','Africa',29.580,-1.390,34.960,4.220),
('TKM','Turkmenistan','Asia',52.490,35.230,66.630,42.780),
('TUR','Turkey','Asia',26.040,35.920,44.820,42.080),
('TUN','Tunisia','Africa',7.510,30.230,11.500,37.340),
('TTO','Trinidad and Tobago','North America',-61.600,10.060,-61.010,10.670),
('TON','Tonga','Oceania',-175.340,-21.260,-175.160,-21.120),
('TGO','Togo','Africa',-0.070,6.090,1.620,11.120),
('TLS','East Timor','Asia',124.920,-9.510,126.920,-8.460),
('TZA','United Republic of Tanzania','Africa',29.340,-11.720,40.460,-1.000),
('TJK','Tajikistan','Asia',67.350,36.690,74.890,41.020),
('TWN','Taiwan','Asia',120.070,22.360,121.930,25.280),
('SYR','Syria','Asia',35.760,32.320,42.360,37.110),
('CHE','Switzerland','Europe',6.060,45.930,10.450,47.770),
('SWE','Sweden','Europe',11.390,55.350,24.160,69.040),
('SWZ','eSwatini','Africa',30.800,-27.310,32.110,-25.750),
('SUR','Suriname','South America',-58.050,1.940,-53.990,5.990),
('SDS','South Sudan','Africa',24.150,3.490,35.270,12.220),
('SDN','Sudan','Africa',21.830,8.670,38.610,22.000),
('LKA','Sri Lanka','Asia',79.790,5.980,81.870,9.810),
('ESP','Spain','Europe',-9.240,36.030,3.250,43.760),
('KOR','South Korea','Asia',126.220,34.350,129.560,38.620),
('ZAF','South Africa','Africa',16.450,-34.750,32.890,-22.150),
('SOM','Somalia','Africa',40.960,-1.700,51.250,11.980),
('SOL','Somaliland','Africa',42.660,8.000,48.940,11.500),
('SLB','Solomon Islands','Oceania',158.940,-8.530,159.880,-7.900),
('SVK','Slovakia','Europe',16.950,47.770,22.540,49.510),
('SVN','Slovenia','Europe',13.400,45.470,16.520,46.860),
('SGP','Singapore','Asia',103.650,1.270,103.970,1.450),
('SLE','Sierra Leone','Africa',-13.290,6.910,-10.280,9.980),
('SRB','Republic of Serbia','Europe',18.910,42.250,22.710,46.110),
('SEN','Senegal','Africa',-17.170,12.330,-11.390,16.640),
('SAU','Saudi Arabia','Asia',34.620,16.370,55.640,32.120),
('STP','São Tomé and Principe','Africa',6.520,0.120,6.750,0.400),
('SMR','San Marino','Europe',12.400,43.900,12.510,43.980),
('WSM','Samoa','Oceania',-172.740,-13.800,-172.220,-13.470),
('VCT','Saint Vincent and the Grenadines','North America',-61.280,13.160,-61.120,13.360),
('LCA','Saint Lucia','North America',-61.060,13.820,-60.890,14.010),
('KNA','Saint Kitts and Nevis','North America',-62.840,17.240,-62.630,17.400),
('RWA','Rwanda','Africa',29.010,-2.720,30.830,-1.070),
('RUS','Russia','Europe',-180.000,41.210,180.000,81.080),
('ROU','Romania','Europe',20.240,43.670,29.710,48.260),
('QAT','Qatar','Asia',50.760,24.610,51.600,25.980),
('PRT','Portugal','Europe',-9.470,37.010,-6.210,41.940),
('POL','Poland','Europe',14.130,49.070,24.110,54.840),
('PHL','Philippines','Asia',117.310,5.660,126.580,18.620),
('PER','Peru','South America',-81.280,-18.350,-68.690,-0.110),
('PRY','Paraguay','South America',-62.650,-27.550,-54.240,-19.290),
('PNG','Papua New Guinea','Oceania',140.970,-10.640,155.960,-2.610),
('PAN','Panama','North America',-82.940,7.220,-77.210,9.600),
('PLW','Palau','Oceania',134.510,7.380,134.660,7.660),
('PAK','Pakistan','Asia',60.840,23.810,77.050,37.020),
('OMN','Oman','Asia',51.980,16.650,59.800,24.980),
('NOR','Norway','Europe',4.930,58.020,30.940,80.400),
('PRK','North Korea','Asia',124.360,37.730,130.690,42.540),
('NGA','Nigeria','Africa',2.690,4.290,14.630,13.870),
('NER','Niger','Africa',0.160,11.700,15.950,23.520),
('NIC','Nicaragua','North America',-87.340,10.920,-83.160,14.990),
('NZL','New Zealand','Oceania',166.730,-46.610,178.540,-34.930),
('NIU','Niue','Oceania',-169.950,-19.140,-169.800,-18.970),
('COK','Cook Islands','Oceania',-159.840,-21.250,-159.740,-21.190),
('NLD','Netherlands','Europe',3.590,50.750,7.200,53.410),
('ABW','Aruba','North America',-70.070,12.440,-69.900,12.570),
('CUW','Curaçao','North America',-69.150,12.050,-68.750,12.340),
('NPL','Nepal','Asia',80.070,26.360,88.110,30.340),
('NRU','Nauru','Oceania',166.910,-0.550,166.960,-0.500),
('NAM','Namibia','Africa',11.740,-28.930,25.260,-16.970),
('MOZ','Mozambique','Africa',30.230,-26.850,40.840,-10.460),
('MAR','Morocco','Africa',-17.000,21.420,-1.070,35.930),
('SAH','Western Sahara','Africa',-17.050,20.810,-8.680,27.660),
('MNE','Montenegro','Europe',18.440,41.870,20.340,43.530),
('MNG','Mongolia','Asia',87.810,41.740,119.710,52.070),
('MDA','Moldova','Europe',26.620,45.450,29.880,48.480),
('MCO','Monaco','Europe',7.380,43.730,7.440,43.770),
('MEX','Mexico','North America',-117.130,14.550,-86.820,32.720),
('MRT','Mauritania','Africa',-17.050,14.810,-4.820,27.290),
('MLT','Malta','Europe',14.350,35.820,14.570,35.960),
('MLI','Mali','Africa',-12.280,10.160,4.230,25.000),
('MYS','Malaysia','Asia',100.120,0.860,119.130,6.680),
('MWI','Malawi','Africa',32.670,-16.560,35.850,-9.410),
('MDG','Madagascar','Africa',43.270,-25.540,50.480,-12.430),
('MKD','North Macedonia','Europe',20.490,40.850,23.010,42.310),
('LUX','Luxembourg','Europe',5.790,49.450,6.340,50.120),
('LTU','Lithuania','Europe',21.050,53.940,26.590,56.410),
('LIE','Liechtenstein','Europe',9.490,47.060,9.580,47.270),
('LBY','Libya','Africa',9.450,19.500,25.150,33.180),
('LBR','Liberia','Africa',-11.510,4.350,-7.450,8.490),
('LSO','Lesotho','Africa',27.050,-30.640,29.390,-28.580),
('LBN','Lebanon','Asia',35.110,33.080,36.580,34.630),
('LVA','Latvia','Europe',21.050,55.670,28.150,58.060),
('LAO','Laos','Asia',100.120,13.920,107.650,22.380),
('KGZ','Kyrgyzstan','Asia',69.600,39.350,80.210,43.240),
('KWT','Kuwait','Asia',46.530,28.530,48.440,29.980),
('KOS','Kosovo','Europe',20.060,41.870,21.750,43.090),
('KIR','Kiribati','Oceania',-157.420,1.730,-157.250,1.860),
('KEN','Kenya','Africa',33.900,-4.690,41.880,5.490),
('KAZ','Kazakhstan','Asia',46.660,40.660,87.320,55.390),
('JOR','Jordan','Asia',34.950,29.190,39.150,33.370),
('JPN','Japan','Asia',129.580,31.180,145.350,45.510),
('JAM','Jamaica','North America',-78.220,17.830,-76.350,18.460),
('ITA','Italy','Europe',6.630,36.690,17.950,46.940),
('ISR','Israel','Asia',34.250,29.480,35.840,33.420),
('PSX','Palestine','Asia',34.200,31.210,35.550,32.400),
('IRL','Ireland','Europe',-10.000,51.580,-6.030,55.150),
('IRQ','Iraq','Asia',38.770,29.100,48.550,37.370),
('IRN','Iran','Asia',44.020,25.100,63.170,39.650),
('IDN','Indonesia','Asia',95.210,-10.340,140.980,5.630),
('IND','India','Asia',68.170,8.080,97.340,35.500),
('ISL','Iceland','Europe',-24.220,63.410,-13.570,66.430),
('HUN','Hungary','Europe',16.090,45.770,22.880,48.530),
('HND','Honduras','North America',-89.360,12.980,-83.160,16.000),
('HTI','Haiti','North America',-74.230,18.040,-71.660,19.900),
('GUY','Guyana','South America',-61.380,1.200,-56.480,8.550),
('GNB','Guinea-Bissau','Africa',-16.710,10.940,-13.730,12.680),
('GIN','Guinea','Africa',-15.040,7.220,-7.820,12.670),
('GTM','Guatemala','North America',-92.240,13.740,-88.230,17.820),
('GRD','Grenada','North America',-61.720,12.010,-61.610,12.220),
('GRC','Greece','Europe',20.000,36.770,26.620,41.720),
('GHA','Ghana','Africa',-3.240,4.760,1.190,11.120),
('DEU','Germany','Europe',5.990,47.420,15.020,54.900),
('GEO','Georgia','Asia',39.980,41.070,46.460,43.530),
('GMB','Gambia','Africa',-16.760,13.060,-15.510,13.590),
('GAB','Gabon','Africa',8.820,-3.920,14.480,2.300),
('FRA','France','Europe',-54.620,2.120,9.550,51.100),
('SPM','Saint Pierre and Miquelon','North America',-56.390,46.840,-56.270,47.070),
('WLF','Wallis and Futuna','Oceania',-178.160,-14.320,-178.050,-14.240),
('MAF','Saint Martin','North America',-63.120,18.070,-63.010,18.120),
('BLM','Saint Barthelemy','North America',-62.870,17.880,-62.800,17.920),
('PYF','French Polynesia','Oceania',-149.610,-17.730,-149.320,-17.520),
('NCL','New Caledonia','Oceania',164.200,-22.380,166.940,-20.250),
('ALD','Aland','Europe',19.690,60.100,20.260,60.350),
('FIN','Finland','Europe',20.620,59.970,31.290,70.060),
('FJI','Fiji','Oceania',177.320,-18.250,180.000,-16.150),
('ETH','Ethiopia','Africa',33.010,3.460,47.980,14.850),
('EST','Estonia','Europe',23.490,57.530,28.010,59.640),
('ERI','Eritrea','Africa',36.430,12.470,43.120,18.010),
('GNQ','Equatorial Guinea','Africa',9.590,1.000,11.340,2.300),
('SLV','El Salvador','North America',-90.100,13.180,-87.720,14.420),
('EGY','Egypt','Africa',24.730,22.000,36.870,31.650),
('ECU','Ecuador','South America',-80.900,-4.990,-75.260,1.460),
('DOM','Dominican Republic','North America',-71.780,17.650,-68.680,19.910),
('DMA','Dominica','North America',-61.480,15.250,-61.280,15.590),
('DJI','Djibouti','Africa',41.770,10.980,43.410,12.710),
('GRL','Greenland','North America',-72.820,59.930,-11.530,83.560),
('FRO','Faroe Islands','Europe',-7.170,62.090,-6.630,62.290),
('DNK','Denmark','Europe',8.130,54.830,12.570,57.450),
('CZE','Czechia','Europe',12.450,48.600,18.830,50.900),
('CYN','Northern Cyprus','Asia',32.710,35.070,34.000,35.390),
('CYP','Cyprus','Asia',32.710,34.580,34.000,35.170),
('CUB','Cuba','North America',-84.330,19.860,-74.250,23.160),
('HRV','Croatia','Europe',13.580,42.430,19.010,46.500),
('CIV','Ivory Coast','Africa',-8.600,4.350,-2.510,10.720),
('CRI','Costa Rica','North America',-85.830,8.070,-82.560,11.060),
('COD','Democratic Republic of the Congo','Africa',12.210,-13.390,31.250,5.310),
('COG','Republic of the Congo','Africa',11.130,-5.000,18.610,3.680),
('COM','Comoros','Africa',43.230,-11.900,43.470,-11.610),
('COL','Colombia','South America',-78.860,-4.240,-66.880,12.420),
('CHN','China','Asia',73.630,18.220,134.750,53.550),
('MAC','Macao S.A.R','Asia',113.480,22.200,113.530,22.250),
('HKG','Hong Kong S.A.R.','Asia',114.020,22.300,114.270,22.540),
('CHL','Chile','South America',-75.660,-54.850,-67.010,-17.510),
('TCD','Chad','Africa',13.450,7.520,23.980,23.450),
('CAF','Central African Republic','Africa',14.620,2.270,27.400,11.000),
('CPV','Cabo Verde','Africa',-23.710,14.960,-23.440,15.270),
('CAN','Canada','North America',-141.000,41.670,-52.650,83.020),
('CMR','Cameroon','Africa',8.560,1.910,16.180,13.080),
('KHM','Cambodia','Asia',102.320,10.410,107.610,14.710),
('MMR','Myanmar','Asia',92.180,10.190,101.140,28.220),
('BDI','Burundi','Africa',29.010,-4.450,30.790,-2.340),
('BFA','Burkina Faso','Africa',-5.520,9.480,2.390,15.050),
('BGR','Bulgaria','Europe',22.340,41.240,28.590,44.240),
('BRN','Brunei','Asia',114.060,4.020,115.030,4.900),
('BRA','Brazil','South America',-74.000,-33.740,-34.810,5.200),
('BWA','Botswana','Africa',19.980,-26.850,29.360,-17.790),
('BIH','Bosnia and Herzegovina','Europe',15.740,42.560,19.580,45.220),
('BOL','Bolivia','South America',-69.620,-22.820,-57.570,-9.710),
('BTN','Bhutan','Asia',88.860,26.700,92.080,28.110),
('BEN','Benin','Africa',0.780,6.220,3.830,12.370),
('BLZ','Belize','North America',-89.240,15.890,-88.100,18.470),
('BEL','Belgium','Europe',2.520,49.540,6.120,51.390),
('BLR','Belarus','Europe',23.480,51.380,32.700,56.140),
('BRB','Barbados','North America',-59.610,13.080,-59.430,13.320),
('BGD','Bangladesh','Asia',88.080,20.790,92.590,26.370),
('BHR','Bahrain','Asia',50.450,25.880,50.610,26.190),
('BHS','The Bahamas','North America',-77.230,25.900,-77.040,26.490),
('AZE','Azerbaijan','Asia',44.770,38.410,49.780,41.890),
('AUT','Austria','Europe',9.520,46.420,17.150,48.980),
('AUS','Australia','Oceania',113.420,-43.610,153.600,-10.710),
('IOA','Indian Ocean Territories','Asia',105.580,-10.560,105.730,-10.430),
('NFK','Norfolk Island','Oceania',167.920,-29.080,167.980,-29.020),
('ATC','Ashmore and Cartier Islands','Oceania',123.570,-12.440,123.600,-12.420),
('ARM','Armenia','Asia',43.440,38.880,46.550,41.290),
('ARG','Argentina','South America',-73.580,-55.030,-53.670,-21.840),
('ATG','Antigua and Barbuda','North America',-61.860,17.010,-61.720,17.170),
('AGO','Angola','Africa',11.740,-18.000,23.990,-4.620),
('AND','Andorra','Europe',1.430,42.430,1.710,42.600),
('DZA','Algeria','Africa',-8.680,18.990,11.970,37.090),
('ALB','Albania','Europe',19.340,39.710,20.960,42.630),
('AFG','Afghanistan','Asia',60.490,29.390,74.890,38.460),
('KAS','Siachen Glacier','Asia',76.770,35.110,77.800,35.660),
('ATA','Antarctica','Antarctica',-180.000,-90.000,180.000,-63.230),
('SXM','Sint Maarten','North America',-63.120,18.020,-63.010,18.070),
('TUV','Tuvalu','Oceania',179.200,-8.520,179.210,-8.490),
('THA','Thailand','Asia',97.350,5.610,105.630,20.460)
on conflict (iso3) do nothing;

-- เช็คอิน v3: เพิ่มรหัสประเทศ (p_cty = ISO3) ตรวจกับกรอบพิกัดประเทศที่ตารางสถานที่ฝั่งเซิร์ฟเวอร์
-- ถ้าอยู่ในไทยและส่งรหัสจังหวัดมา จะได้ภูมิภาค/จังหวัด/อำเภอ/ตำบลต่อเหมือน v2
create or replace function public.check_in_v3(p_place_id bigint, p_lat float8, p_lng float8, p_rating int, p_caption text,
                                              p_cty text, p_pro text, p_dis text, p_sub text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; v_place places%rowtype; v_cty countries%rowtype; v_pro admin_areas%rowtype; v_dis admin_areas%rowtype; v_sub admin_areas%rowtype;
  v_new jsonb := '[]'::jsonb; v_pts int := 5; v_n int;
begin
  v_id := public.check_in(p_place_id, p_lat, p_lng, p_rating, p_caption);
  select * into v_place from places where id = p_place_id;

  -- จังหวัดไทยที่ตรวจผ่าน => ประเทศคือไทยแน่นอน
  select * into v_pro from admin_areas where level = 'pro' and code = p_pro
    and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
  if found then p_cty := 'THA'; end if;

  select * into v_cty from countries where iso3 = p_cty
    and v_place.lat between min_lat and max_lat and v_place.lng between min_lng and max_lng;
  if found then
    insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'con', v_cty.continent, 500, v_id)
      on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','con','code',v_cty.continent,'points',500)); v_pts := v_pts + 500; end if;
    insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'cty', v_cty.iso3, 200, v_id)
      on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','cty','code',v_cty.iso3,'name',v_cty.name,'points',200)); v_pts := v_pts + 200; end if;
  end if;

  if v_pro.code is not null and v_cty.iso3 = 'THA' then
    insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'reg', v_pro.region, 100, v_id)
      on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','reg','code',v_pro.region,'points',100)); v_pts := v_pts + 100; end if;
    insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'pro', v_pro.code, 50, v_id)
      on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','pro','code',v_pro.code,'name',v_pro.name_th,'points',50)); v_pts := v_pts + 50; end if;

    select * into v_dis from admin_areas where level = 'dis' and code = p_dis and parent = v_pro.code
      and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
    if found then
      insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'dis', v_dis.code, 20, v_id)
        on conflict do nothing;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','dis','code',v_dis.code,'name',v_dis.name_th,'points',20)); v_pts := v_pts + 20; end if;
      select * into v_sub from admin_areas where level = 'sub' and code = p_sub and parent = v_dis.code
        and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
      if found then
        insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'sub', v_sub.code, 10, v_id)
          on conflict do nothing;
        get diagnostics v_n = row_count;
        if v_n > 0 then v_new := v_new || jsonb_build_array(jsonb_build_object('level','sub','code',v_sub.code,'name',v_sub.name_th,'points',10)); v_pts := v_pts + 10; end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('checkin_id', v_id, 'points', v_pts, 'unlocks', v_new);
end $$;
revoke execute on function public.check_in_v3(bigint, float8, float8, int, text, text, text, text, text) from public, anon;
grant execute on function public.check_in_v3(bigint, float8, float8, int, text, text, text, text, text) to authenticated;
