-- Dashboard de KPIs do Admin (itens 19-20) — mapa de cobertura geográfica
-- pedido pelo usuário ("mapa múndi com os pontos onde temos clientes, por
-- cidade"). O schema não tem coluna de cidade em lugar nenhum (só lat/lng);
-- em vez de chamar uma API de geocoding, guardamos aqui uma lista estática
-- de referência (as 27 capitais + principais cidades/regiões metropolitanas
-- do Brasil) e casamos cada tutor/profissional com a mais próxima por
-- distância (public.distance_km, já usado por professional_service_areas).
-- Tabela plana e sem RLS restritiva: são coordenadas de cidades, dado
-- público, não de pessoa — select liberado geral, sem insert/update/delete
-- fora de migration.
create table public.reference_cities (
  id serial primary key,
  nome text not null,
  uf text not null,
  lat double precision not null,
  lng double precision not null
);

comment on table public.reference_cities is
  'Lista curada (não é o cadastro completo de municípios do IBGE) usada só
   pra rotular a cidade mais próxima de um ponto lat/lng no mapa de
   cobertura do Admin. Extensível: basta inserir mais linhas se uma região
   precisar de mais granularidade.';

create index reference_cities_uf_idx on public.reference_cities (uf);

alter table public.reference_cities enable row level security;

create policy reference_cities_select_all on public.reference_cities
  for select using (true);

insert into public.reference_cities (nome, uf, lat, lng) values
  ('São Paulo', 'SP', -23.5505, -46.6333),
  ('Rio de Janeiro', 'RJ', -22.9068, -43.1729),
  ('Vitória', 'ES', -20.3155, -40.3128),
  ('Belo Horizonte', 'MG', -19.9167, -43.9345),
  ('Salvador', 'BA', -12.9714, -38.5014),
  ('Aracaju', 'SE', -10.9472, -37.0731),
  ('Recife', 'PE', -8.0476, -34.8770),
  ('Maceió', 'AL', -9.6498, -35.7089),
  ('João Pessoa', 'PB', -7.1195, -34.8450),
  ('Natal', 'RN', -5.7945, -35.2110),
  ('Fortaleza', 'CE', -3.7172, -38.5433),
  ('Teresina', 'PI', -5.0892, -42.8019),
  ('São Luís', 'MA', -2.5307, -44.3068),
  ('Belém', 'PA', -1.4558, -48.4902),
  ('Macapá', 'AP', 0.0349, -51.0694),
  ('Manaus', 'AM', -3.1190, -60.0217),
  ('Boa Vista', 'RR', 2.8235, -60.6758),
  ('Rio Branco', 'AC', -9.9754, -67.8249),
  ('Brasília', 'DF', -15.7939, -47.8828),
  ('Goiânia', 'GO', -16.6869, -49.2648),
  ('Porto Velho', 'RO', -8.7619, -63.9039),
  ('Palmas', 'TO', -10.2491, -48.3243),
  ('Cuiabá', 'MT', -15.6014, -56.0979),
  ('Campo Grande', 'MS', -20.4697, -54.6201),
  ('Curitiba', 'PR', -25.4284, -49.2733),
  ('Florianópolis', 'SC', -27.5954, -48.5480),
  ('Porto Alegre', 'RS', -30.0346, -51.2177),
  ('Guarulhos', 'SP', -23.4538, -46.5333),
  ('Campinas', 'SP', -22.9099, -47.0626),
  ('São Bernardo do Campo', 'SP', -23.6939, -46.5650),
  ('Santo André', 'SP', -23.6639, -46.5383),
  ('Osasco', 'SP', -23.5329, -46.7918),
  ('São José dos Campos', 'SP', -23.1791, -45.8872),
  ('Ribeirão Preto', 'SP', -21.1775, -47.8103),
  ('Sorocaba', 'SP', -23.5015, -47.4526),
  ('Santos', 'SP', -23.9608, -46.3336),
  ('Mauá', 'SP', -23.6678, -46.4614),
  ('Diadema', 'SP', -23.6864, -46.6228),
  ('Jundiaí', 'SP', -23.1864, -46.8842),
  ('Piracicaba', 'SP', -22.7253, -47.6492),
  ('Bauru', 'SP', -22.3246, -49.0871),
  ('São José do Rio Preto', 'SP', -20.8113, -49.3758),
  ('Franca', 'SP', -20.5386, -47.4008),
  ('Presidente Prudente', 'SP', -22.1256, -51.3889),
  ('Niterói', 'RJ', -22.8833, -43.1036),
  ('Duque de Caxias', 'RJ', -22.7856, -43.3117),
  ('Nova Iguaçu', 'RJ', -22.7592, -43.4511),
  ('São Gonçalo', 'RJ', -22.8268, -43.0634),
  ('Campos dos Goytacazes', 'RJ', -21.7622, -41.3183),
  ('Petrópolis', 'RJ', -22.5112, -43.1779),
  ('Volta Redonda', 'RJ', -22.5231, -44.1042),
  ('Uberlândia', 'MG', -18.9186, -48.2772),
  ('Contagem', 'MG', -19.9319, -44.0536),
  ('Juiz de Fora', 'MG', -21.7642, -43.3496),
  ('Betim', 'MG', -19.9678, -44.1983),
  ('Montes Claros', 'MG', -16.7350, -43.8617),
  ('Uberaba', 'MG', -19.7483, -47.9319),
  ('Governador Valadares', 'MG', -18.8511, -41.9494),
  ('Vitória da Conquista', 'BA', -14.8619, -40.8444),
  ('Feira de Santana', 'BA', -12.2664, -38.9663),
  ('Ilhéus', 'BA', -14.7889, -39.0494),
  ('Camaçari', 'BA', -12.6975, -38.3242),
  ('Juazeiro', 'BA', -9.4111, -40.4986),
  ('Caruaru', 'PE', -8.2836, -35.9761),
  ('Petrolina', 'PE', -9.3891, -40.5030),
  ('Jaboatão dos Guararapes', 'PE', -8.1130, -35.0150),
  ('Olinda', 'PE', -8.0089, -34.8553),
  ('Campina Grande', 'PB', -7.2306, -35.8811),
  ('Mossoró', 'RN', -5.1875, -37.3444),
  ('Juazeiro do Norte', 'CE', -7.2130, -39.3153),
  ('Sobral', 'CE', -3.6880, -40.3497),
  ('Caucaia', 'CE', -3.7361, -38.6531),
  ('Imperatriz', 'MA', -5.5264, -47.4917),
  ('Parnaíba', 'PI', -2.9055, -41.7767),
  ('Ananindeua', 'PA', -1.3656, -48.3722),
  ('Santarém', 'PA', -2.4431, -54.7083),
  ('Marabá', 'PA', -5.3686, -49.1178),
  ('Parintins', 'AM', -2.6283, -56.7358),
  ('Manacapuru', 'AM', -3.2997, -60.6206),
  ('Aparecida de Goiânia', 'GO', -16.8231, -49.2436),
  ('Anápolis', 'GO', -16.3286, -48.9531),
  ('Rondonópolis', 'MT', -16.4706, -54.6358),
  ('Várzea Grande', 'MT', -15.6467, -56.1325),
  ('Dourados', 'MS', -22.2231, -54.8025),
  ('Corumbá', 'MS', -19.0092, -57.6533),
  ('Londrina', 'PR', -23.3103, -51.1628),
  ('Maringá', 'PR', -23.4205, -51.9331),
  ('Ponta Grossa', 'PR', -25.0950, -50.1619),
  ('Cascavel', 'PR', -24.9578, -53.4595),
  ('Foz do Iguaçu', 'PR', -25.5478, -54.5882),
  ('São José dos Pinhais', 'PR', -25.5347, -49.2058),
  ('Joinville', 'SC', -26.3045, -48.8487),
  ('Blumenau', 'SC', -26.9155, -49.0709),
  ('Chapecó', 'SC', -27.0965, -52.6156),
  ('Criciúma', 'SC', -28.6775, -49.3696),
  ('Itajaí', 'SC', -26.9078, -48.6614),
  ('Caxias do Sul', 'RS', -29.1685, -51.1794),
  ('Pelotas', 'RS', -31.7654, -52.3376),
  ('Canoas', 'RS', -29.9177, -51.1836),
  ('Santa Maria', 'RS', -29.6842, -53.8069),
  ('Novo Hamburgo', 'RS', -29.6783, -51.1306),
  ('Passo Fundo', 'RS', -28.2628, -52.4067);
