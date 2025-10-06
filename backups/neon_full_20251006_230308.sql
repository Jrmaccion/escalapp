--
-- PostgreSQL database dump
--

\restrict ngzNYRkQPeRsv0VUF1GVaSUXzWgWzKdj7Xvzmcr3EIWBtfBIkC8EqQp8yBazP2d

-- Dumped from database version 17.5 (84bec44)
-- Dumped by pg_dump version 17.6

-- Started on 2025-10-06 23:03:08

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 131072)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 3487 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 896 (class 1247 OID 180225)
-- Name: GroupStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GroupStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'PLAYED',
    'SKIPPED',
    'POSTPONED'
);


--
-- TOC entry 860 (class 1247 OID 139274)
-- Name: MatchStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MatchStatus" AS ENUM (
    'PENDING',
    'DATE_PROPOSED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 139264)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 139344)
-- Name: group_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_players (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "playerId" text NOT NULL,
    "position" integer NOT NULL,
    points double precision DEFAULT 0 NOT NULL,
    streak integer DEFAULT 0 NOT NULL,
    "usedComodin" boolean DEFAULT false NOT NULL,
    "comodinReason" text,
    "comodinAt" timestamp(3) without time zone,
    "substitutePlayerId" text,
    locked boolean DEFAULT false NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 139337)
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id text NOT NULL,
    "roundId" text NOT NULL,
    number integer NOT NULL,
    level integer NOT NULL,
    "graceEndAt" timestamp(3) without time zone,
    "skippedReason" text,
    status public."GroupStatus" DEFAULT 'PENDING'::public."GroupStatus" NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 139365)
-- Name: match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_results (
    id text NOT NULL,
    "matchId" text NOT NULL,
    "playerId" text NOT NULL,
    games integer NOT NULL,
    sets integer NOT NULL,
    points double precision NOT NULL,
    "isWinner" boolean NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 139354)
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "setNumber" integer NOT NULL,
    "team1Player1Id" text NOT NULL,
    "team1Player2Id" text NOT NULL,
    "team2Player1Id" text NOT NULL,
    "team2Player2Id" text NOT NULL,
    "team1Games" integer,
    "team2Games" integer,
    "tiebreakScore" text,
    "isConfirmed" boolean DEFAULT false NOT NULL,
    "reportedById" text,
    "confirmedById" text,
    "photoUrl" text,
    "proposedDate" timestamp(3) without time zone,
    "proposedById" text,
    "acceptedDate" timestamp(3) without time zone,
    "acceptedBy" text[],
    status public."MatchStatus" DEFAULT 'PENDING'::public."MatchStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "disputeReason" text,
    "disputedAt" timestamp(3) without time zone,
    "disputedBy" text
);


--
-- TOC entry 220 (class 1259 OID 139311)
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    "notificationsReadAt" timestamp with time zone
);


--
-- TOC entry 227 (class 1259 OID 139372)
-- Name: rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rankings (
    id text NOT NULL,
    "tournamentId" text NOT NULL,
    "playerId" text NOT NULL,
    "roundNumber" integer NOT NULL,
    "totalPoints" double precision NOT NULL,
    "roundsPlayed" integer NOT NULL,
    "averagePoints" double precision NOT NULL,
    "position" integer NOT NULL,
    "ironmanPosition" integer NOT NULL,
    movement text NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 139328)
-- Name: rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rounds (
    id text NOT NULL,
    "tournamentId" text NOT NULL,
    number integer NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isClosed" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 139446)
-- Name: streak_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_history (
    id text NOT NULL,
    "playerId" text NOT NULL,
    "roundId" text NOT NULL,
    "groupId" text NOT NULL,
    "streakType" text NOT NULL,
    "streakCount" integer NOT NULL,
    "bonusPoints" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 139318)
-- Name: tournament_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_players (
    id text NOT NULL,
    "tournamentId" text NOT NULL,
    "playerId" text NOT NULL,
    "joinedRound" integer DEFAULT 1 NOT NULL,
    "comodinesUsed" integer DEFAULT 0 NOT NULL,
    "substituteAppearances" integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 139296)
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id text NOT NULL,
    title text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "totalRounds" integer NOT NULL,
    "roundDurationDays" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isPublic" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "maxComodinesPerPlayer" integer DEFAULT 1 NOT NULL,
    "enableMeanComodin" boolean DEFAULT true NOT NULL,
    "enableSubstituteComodin" boolean DEFAULT true NOT NULL,
    "substituteCreditFactor" double precision DEFAULT 0.5 NOT NULL,
    "substituteMaxAppearances" integer DEFAULT 2 NOT NULL,
    "continuityEnabled" boolean DEFAULT true NOT NULL,
    "continuityMaxBonus" double precision DEFAULT 9.0 NOT NULL,
    "continuityMinRounds" integer DEFAULT 2 NOT NULL,
    "continuityMode" text DEFAULT 'MATCHES'::text NOT NULL,
    "continuityPointsPerRound" double precision DEFAULT 3.0 NOT NULL,
    "continuityPointsPerSet" double precision DEFAULT 1.0 NOT NULL
);


--
-- TOC entry 218 (class 1259 OID 139287)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 3470 (class 0 OID 139264)
-- Dependencies: 217
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5782b001-f005-423d-8ff8-ec6315ff7aff	0cc59209023ed399eb6139ebc0412f8ed22e4f408837b3370245104d5a884005	2025-09-08 22:26:04.879357+00	20250903210313_update	\N	\N	2025-09-08 22:26:04.207202+00	1
6e27ebf4-9a4b-471f-a73c-b8416e66b8c5	99bb1f956b2af63dbd6df9c73a23a395f1317f22e23734b961beb73db53ea2e3	2025-09-08 22:26:05.887284+00	20250905135603_streak_config_fields	\N	\N	2025-09-08 22:26:05.092959+00	1
7c34b075-fe69-4544-80ac-424141ba27a2	968ee204ed93186a68fd9013821a3302d59802ea40eeea740630dcdcb401b32c	2025-09-08 22:26:07.019495+00	20250905153402_rename_streak_to_continuity	\N	\N	2025-09-08 22:26:06.201976+00	1
d43e41c7-8fef-40f7-b07a-b882d4b65b9f	6559aa8c5986cac16f13779b19eadb41019c5d32e09da8cf8734070e2af23ce7	2025-09-08 22:26:08.24529+00	20250905230731_round_add_updated_at	\N	\N	2025-09-08 22:26:07.427342+00	1
f0183edb-9f7c-4ceb-a2b3-327b03aa2f69	c710e472d81d75599c71271b6b24f73ec6cbcbf51eb18b7485e73c400c6afdca	2025-09-08 22:26:09.283359+00	20250905232250_nueva	\N	\N	2025-09-08 22:26:08.460475+00	1
1da13c3a-4c7c-4af6-b51d-cd33f2c10047	302e910da711e9d8986f27db62a932053f32cde5e14292ada6a503c32459f96e	2025-09-14 18:15:29.677284+00	20250913093821_player_notifications_read_at	\N	\N	2025-09-14 18:15:29.545972+00	1
26ba2ab4-54c8-48be-bed9-466e0f081509	966078939db3566ae5d57c971ee47a6984a134e876c7b7cc70e2b4bcb4d2141e	2025-10-04 21:40:55.179068+00	20251003223952_add_group_status_and_locked_fields	\N	\N	2025-10-04 21:40:55.065382+00	1
\.


--
-- TOC entry 3477 (class 0 OID 139344)
-- Dependencies: 224
-- Data for Name: group_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.group_players (id, "groupId", "playerId", "position", points, streak, "usedComodin", "comodinReason", "comodinAt", "substitutePlayerId", locked) FROM stdin;
cmfk1zwr5001ia8k6k5u23mpe	cmfk1zwqc001ga8k6q7pxp3vr	cmfk1snzi001voamuf1dcdtav	1	17	0	f	\N	\N	\N	f
cmfk1zws0001ka8k6s820enq7	cmfk1zwqc001ga8k6q7pxp3vr	cmfk1sf0z000roamu0ggralx2	2	10	0	f	\N	\N	\N	f
cmfk1zwsg001ma8k6wjxhudxo	cmfk1zwqc001ga8k6q7pxp3vr	cmfk1sma1001noamu9u7dajci	3	12	0	f	\N	\N	\N	f
cmfk21w5l004oa8k64akop2xt	cmfk1zwqc001ga8k6q7pxp3vr	cmfk1sinh0017oamue0zyobe2	4	11	0	f	\N	\N	\N	f
cmfk1zwtl001sa8k6bdbddmd0	cmfk1zwt7001qa8k6uwxm5yay	cmfk1sld0001joamufq0zhnf4	1	8	0	f	\N	\N	\N	f
cmfk1zwuc001wa8k6kxfbu7z3	cmfk1zwt7001qa8k6uwxm5yay	cmfk1sqov0027oamuan625w73	2	7	0	f	\N	\N	\N	f
cmfk1zwuq001ya8k6uk91v5le	cmfk1zwt7001qa8k6uwxm5yay	cmfk1sn4z001roamuw3z0efwe	3	6	0	f	\N	\N	\N	f
cmfk21w88004wa8k6jmjlf3k8	cmfk1zwt7001qa8k6uwxm5yay	cmfk1ssgz002foamusz7sdg4n	4	15	0	f	\N	\N	\N	f
cmfk1zwxd002ca8k6m0w5xvsy	cmfk1zwx0002aa8k61y2e3iqo	cmfk1sagz0007oamu036pcw9b	1	11	0	f	\N	\N	\N	f
cmfk1zwxr002ea8k6odvoplpy	cmfk1zwx0002aa8k61y2e3iqo	cmfk1s9fh0003oamu0eas10b9	2	12	0	f	\N	\N	\N	f
cmfk1zwy5002ga8k6dx0w4br0	cmfk1zwx0002aa8k61y2e3iqo	cmfk1spt70023oamuf8qs2haa	3	5	0	f	\N	\N	\N	f
cmfk1zwyi002ia8k6ocz5s60h	cmfk1zwx0002aa8k61y2e3iqo	cmfk1ste2002joamub3kmmodh	4	12	0	f	\N	\N	\N	f
cmfk1zwzn002oa8k6sbfg742w	cmfk1zwyw002ka8k6r8hvqamt	cmfk1sfxf000voamuhd2jlcwe	1	15	0	f	\N	\N	\N	f
cmfk1zx01002qa8k60ewyx7ij	cmfk1zwyw002ka8k6r8hvqamt	cmfk1skd8001foamu7ou1ahaw	2	7	0	f	\N	\N	\N	f
cmfk1zx0e002sa8k69fw6mrub	cmfk1zwyw002ka8k6r8hvqamt	cmfk1srkb002boamu9y56r9bd	3	7	0	f	\N	\N	\N	f
cmfk21cpa0047a8k6rhl8k7kw	cmfk1zwyw002ka8k6r8hvqamt	cmfk1sgu1000zoamuu2rz8wvi	4	7	0	f	\N	\N	\N	f
cmfk1zwvh0022a8k6kx552570	cmfk1zwv30020a8k65nl66nei	cmfk1se5b000noamupixwxn1e	1	0	0	f	\N	\N	\N	f
cmfk1zwvv0024a8k6lih550cn	cmfk1zwv30020a8k65nl66nei	cmfk1su6z002noamuy2ideni1	2	0	0	f	\N	\N	\N	f
cmfk1zww80026a8k6w2gx443e	cmfk1zwv30020a8k65nl66nei	cmfk1sbe9000boamu2df41jg2	3	0	0	f	\N	\N	\N	f
cmfk1zwwm0028a8k66pbsrynt	cmfk1zwv30020a8k65nl66nei	cmfk1sowd001zoamuvf151dqr	4	0	0	f	\N	\N	\N	f
cmfk1zx1x0030a8k69fgq5wx2	cmfk1zx0s002ua8k60n11szcj	cmfk1sd7y000joamuz4ue29rx	1	13	0	f	\N	\N	\N	f
cmfk1zx1j002ya8k6r7e17ool	cmfk1zx0s002ua8k60n11szcj	cmfk1sjj4001boamuoskjjwch	2	13	0	f	\N	\N	\N	f
cmfk1zx16002wa8k6tg7gypcd	cmfk1zx0s002ua8k60n11szcj	cmfk1shr10013oamu22yhglpk	3	12	0	f	\N	\N	\N	f
cmfk1zx2a0032a8k654afe29m	cmfk1zx0s002ua8k60n11szcj	cmfk1scaj000foamubym5sipp	4	6	0	f	\N	\N	\N	f
\.


--
-- TOC entry 3476 (class 0 OID 139337)
-- Dependencies: 223
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.groups (id, "roundId", number, level, "graceEndAt", "skippedReason", status) FROM stdin;
cmfk1zwqc001ga8k6q7pxp3vr	cmfbpafni0002c0qry7rzngif	1	1	\N	\N	PENDING
cmfk1zwt7001qa8k6uwxm5yay	cmfbpafni0002c0qry7rzngif	2	2	\N	\N	PENDING
cmfk1zwv30020a8k65nl66nei	cmfbpafni0002c0qry7rzngif	3	3	\N	\N	PENDING
cmfk1zwx0002aa8k61y2e3iqo	cmfbpafni0002c0qry7rzngif	4	4	\N	\N	PENDING
cmfk1zwyw002ka8k6r8hvqamt	cmfbpafni0002c0qry7rzngif	5	5	\N	\N	PENDING
cmfk1zx0s002ua8k60n11szcj	cmfbpafni0002c0qry7rzngif	6	6	\N	\N	PENDING
\.


--
-- TOC entry 3479 (class 0 OID 139365)
-- Dependencies: 226
-- Data for Name: match_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.match_results (id, "matchId", "playerId", games, sets, points, "isWinner") FROM stdin;
\.


--
-- TOC entry 3478 (class 0 OID 139354)
-- Dependencies: 225
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.matches (id, "groupId", "setNumber", "team1Player1Id", "team1Player2Id", "team2Player1Id", "team2Player2Id", "team1Games", "team2Games", "tiebreakScore", "isConfirmed", "reportedById", "confirmedById", "photoUrl", "proposedDate", "proposedById", "acceptedDate", "acceptedBy", status, "createdAt", "updatedAt", "disputeReason", "disputedAt", "disputedBy") FROM stdin;
cmfk22b24000b14gf1modz9sh	cmfk1zwx0002aa8k61y2e3iqo	2	cmfk1sagz0007oamu036pcw9b	cmfk1spt70023oamuf8qs2haa	cmfk1s9fh0003oamu0eas10b9	cmfk1ste2002joamub3kmmodh	1	4	\N	t	\N	\N	\N	2025-09-18 17:30:00	cmfk1sadr0005oamublcpsauj	\N	{cmfk1sadr0005oamublcpsauj,cmfk1staw002hoamug1o0s6us,cmfk1spq10021oamu8j7koei6}	DATE_PROPOSED	2025-09-14 18:55:35.548	2025-09-18 21:00:31.52	\N	\N	\N
cmfk22azv000114gfeeatbje2	cmfk1zwqc001ga8k6q7pxp3vr	1	cmfk1snzi001voamuf1dcdtav	cmfk1sinh0017oamue0zyobe2	cmfk1sf0z000roamu0ggralx2	cmfk1sma1001noamu9u7dajci	5	3	\N	t	\N	\N	\N	2025-09-30 16:00:00	cmfk1sexh000poamudlgrlzf8	2025-09-30 16:00:00	{cmfk1sexh000poamudlgrlzf8,cmfk1sikc0015oamuq2lzfs4d,cmfk1sm6w001loamuhgqmxcfe,cmfk1snw6001toamudjm9kx2n}	SCHEDULED	2025-09-14 18:55:35.468	2025-09-30 20:02:40.185	\N	\N	\N
cmfk22azv000214gfpx7epe81	cmfk1zwqc001ga8k6q7pxp3vr	2	cmfk1snzi001voamuf1dcdtav	cmfk1sma1001noamu9u7dajci	cmfk1sf0z000roamu0ggralx2	cmfk1sinh0017oamue0zyobe2	4	1	\N	t	\N	\N	\N	2025-09-30 16:00:00	cmfk1sexh000poamudlgrlzf8	2025-09-30 16:00:00	{cmfk1sexh000poamudlgrlzf8,cmfk1sikc0015oamuq2lzfs4d,cmfk1sm6w001loamuhgqmxcfe,cmfk1snw6001toamudjm9kx2n}	SCHEDULED	2025-09-14 18:55:35.468	2025-09-30 20:04:19.719	\N	\N	\N
cmfk22b0p000614gfmbfk8rza	cmfk1zwt7001qa8k6uwxm5yay	3	cmfk1sld0001joamufq0zhnf4	cmfk1sqov0027oamuan625w73	cmfk1sn4z001roamuw3z0efwe	cmfk1ssgz002foamusz7sdg4n	2	4	\N	t	cmfk1ssgz002foamusz7sdg4n	cmfk1sld0001joamufq0zhnf4	\N	2025-09-17 16:00:00	cmfk1ssdv002doamugbok4rlj	2025-09-17 16:00:00	{cmfk1ssdv002doamugbok4rlj,cmfk1sn1u001poamurr2hrlcd,cmfk1sl9v001hoamugxbzks16,cmfk1sqll0025oamumqdamlun}	SCHEDULED	2025-09-14 18:55:35.498	2025-09-18 08:26:05.417	\N	\N	\N
cmfk22b0p000414gf94lyp0x6	cmfk1zwt7001qa8k6uwxm5yay	1	cmfk1sld0001joamufq0zhnf4	cmfk1ssgz002foamusz7sdg4n	cmfk1sqov0027oamuan625w73	cmfk1sn4z001roamuw3z0efwe	4	0	\N	t	cmfk1ssgz002foamusz7sdg4n	cmfk1sqov0027oamuan625w73	\N	2025-09-17 16:00:00	cmfk1ssdv002doamugbok4rlj	2025-09-17 16:00:00	{cmfk1ssdv002doamugbok4rlj,cmfk1sn1u001poamurr2hrlcd,cmfk1sl9v001hoamugxbzks16,cmfk1sqll0025oamumqdamlun}	SCHEDULED	2025-09-14 18:55:35.498	2025-09-18 09:05:41.989	\N	\N	\N
cmfk22b0p000514gf21866zpt	cmfk1zwt7001qa8k6uwxm5yay	2	cmfk1sld0001joamufq0zhnf4	cmfk1sn4z001roamuw3z0efwe	cmfk1sqov0027oamuan625w73	cmfk1ssgz002foamusz7sdg4n	1	4	\N	t	cmfk1ssgz002foamusz7sdg4n	cmfk1sld0001joamufq0zhnf4	\N	2025-09-17 16:00:00	cmfk1ssdv002doamugbok4rlj	2025-09-17 16:00:00	{cmfk1ssdv002doamugbok4rlj,cmfk1sn1u001poamurr2hrlcd,cmfk1sl9v001hoamugxbzks16,cmfk1sqll0025oamumqdamlun}	SCHEDULED	2025-09-14 18:55:35.498	2025-09-18 08:25:46.868	\N	\N	\N
cmfk22b24000c14gfmgics5d5	cmfk1zwx0002aa8k61y2e3iqo	3	cmfk1sagz0007oamu036pcw9b	cmfk1s9fh0003oamu0eas10b9	cmfk1spt70023oamuf8qs2haa	cmfk1ste2002joamub3kmmodh	4	2	\N	t	\N	\N	\N	2025-09-18 17:30:00	cmfk1sadr0005oamublcpsauj	\N	{cmfk1sadr0005oamublcpsauj,cmfk1staw002hoamug1o0s6us,cmfk1spq10021oamu8j7koei6}	DATE_PROPOSED	2025-09-14 18:55:35.548	2025-09-18 21:00:50.467	\N	\N	\N
cmfk22b2t000d14gfv9sya8oq	cmfk1zwyw002ka8k6r8hvqamt	1	cmfk1sfxf000voamuhd2jlcwe	cmfk1sgu1000zoamuu2rz8wvi	cmfk1skd8001foamu7ou1ahaw	cmfk1srkb002boamu9y56r9bd	4	1	\N	t	cmfk1srkb002boamu9y56r9bd	cmfk1sgu1000zoamuu2rz8wvi	\N	2025-09-18 19:00:00	cmfbozhi7000010usvdlkdp76	2025-09-18 19:00:00	{cmfk1sfua000toamucpb629uz,cmfk1sgqw000xoamuyro00l3t,cmfk1ska3001doamudf88m6lz,cmfk1srgy0029oamueuwhgoea,cmfbozhi7000010usvdlkdp76}	SCHEDULED	2025-09-14 18:55:35.574	2025-09-18 20:29:22.184	\N	\N	\N
cmfk22b2u000e14gf8oy8sv9d	cmfk1zwyw002ka8k6r8hvqamt	2	cmfk1sfxf000voamuhd2jlcwe	cmfk1srkb002boamu9y56r9bd	cmfk1skd8001foamu7ou1ahaw	cmfk1sgu1000zoamuu2rz8wvi	4	1	\N	t	cmfk1srkb002boamu9y56r9bd	cmfk1sgu1000zoamuu2rz8wvi	\N	2025-09-18 19:00:00	cmfbozhi7000010usvdlkdp76	2025-09-18 19:00:00	{cmfk1sfua000toamucpb629uz,cmfk1sgqw000xoamuyro00l3t,cmfk1ska3001doamudf88m6lz,cmfk1srgy0029oamueuwhgoea,cmfbozhi7000010usvdlkdp76}	SCHEDULED	2025-09-14 18:55:35.574	2025-09-18 20:29:49.324	\N	\N	\N
cmfk22b24000a14gfmpikgemt	cmfk1zwx0002aa8k61y2e3iqo	1	cmfk1sagz0007oamu036pcw9b	cmfk1ste2002joamub3kmmodh	cmfk1s9fh0003oamu0eas10b9	cmfk1spt70023oamuf8qs2haa	4	2	\N	t	\N	\N	\N	2025-09-18 17:30:00	cmfk1sadr0005oamublcpsauj	\N	{cmfk1sadr0005oamublcpsauj,cmfk1staw002hoamug1o0s6us,cmfk1spq10021oamu8j7koei6}	DATE_PROPOSED	2025-09-14 18:55:35.548	2025-09-18 21:00:06.361	\N	\N	\N
cmfk22b1f000714gf07a2ueir	cmfk1zwv30020a8k65nl66nei	1	cmfk1se5b000noamupixwxn1e	cmfk1sowd001zoamuvf151dqr	cmfk1su6z002noamuy2ideni1	cmfk1sbe9000boamu2df41jg2	\N	\N	\N	f	\N	\N	\N	2025-10-02 19:00:00	cmfk1sbaz0009oamu2b4d3hvn	\N	{cmfk1sbaz0009oamu2b4d3hvn}	DATE_PROPOSED	2025-09-14 18:55:35.523	2025-10-02 10:38:32.019	\N	\N	\N
cmfk22b1f000814gf7recceho	cmfk1zwv30020a8k65nl66nei	2	cmfk1se5b000noamupixwxn1e	cmfk1sbe9000boamu2df41jg2	cmfk1su6z002noamuy2ideni1	cmfk1sowd001zoamuvf151dqr	\N	\N	\N	f	\N	\N	\N	2025-10-02 19:00:00	cmfk1sbaz0009oamu2b4d3hvn	\N	{cmfk1sbaz0009oamu2b4d3hvn}	DATE_PROPOSED	2025-09-14 18:55:35.523	2025-10-02 10:38:32.019	\N	\N	\N
cmfk22b3j000g14gf8hmqssp0	cmfk1zx0s002ua8k60n11szcj	1	cmfk1shr10013oamu22yhglpk	cmfk1scaj000foamubym5sipp	cmfk1sjj4001boamuoskjjwch	cmfk1sd7y000joamuz4ue29rx	1	4	\N	t	cmfbozhi7000010usvdlkdp76	cmfbozhi7000010usvdlkdp76	\N	\N	\N	\N	{}	PENDING	2025-09-14 18:55:35.6	2025-10-06 17:36:03.895	\N	\N	\N
cmfk22b3j000h14gfpu3jcmua	cmfk1zx0s002ua8k60n11szcj	2	cmfk1shr10013oamu22yhglpk	cmfk1sd7y000joamuz4ue29rx	cmfk1sjj4001boamuoskjjwch	cmfk1scaj000foamubym5sipp	5	3	\N	t	cmfbozhi7000010usvdlkdp76	cmfbozhi7000010usvdlkdp76	\N	\N	\N	\N	{}	PENDING	2025-09-14 18:55:35.6	2025-10-06 17:36:44.535	\N	\N	\N
cmfk22b3j000i14gffeffagju	cmfk1zx0s002ua8k60n11szcj	3	cmfk1shr10013oamu22yhglpk	cmfk1sjj4001boamuoskjjwch	cmfk1sd7y000joamuz4ue29rx	cmfk1scaj000foamubym5sipp	4	2	\N	t	cmfbozhi7000010usvdlkdp76	cmfbozhi7000010usvdlkdp76	\N	\N	\N	\N	{}	PENDING	2025-09-14 18:55:35.6	2025-10-06 18:13:09.81	\N	\N	\N
cmfk22azw000314gfjsccphij	cmfk1zwqc001ga8k6q7pxp3vr	3	cmfk1snzi001voamuf1dcdtav	cmfk1sf0z000roamu0ggralx2	cmfk1sma1001noamu9u7dajci	cmfk1sinh0017oamue0zyobe2	5	4	7-5	t	\N	\N	\N	2025-09-30 16:00:00	cmfk1sexh000poamudlgrlzf8	2025-09-30 16:00:00	{cmfk1sexh000poamudlgrlzf8,cmfk1sikc0015oamuq2lzfs4d,cmfk1sm6w001loamuhgqmxcfe,cmfk1snw6001toamudjm9kx2n}	SCHEDULED	2025-09-14 18:55:35.468	2025-09-30 20:03:47.617	\N	\N	\N
cmfk22b1f000914gfwga5h4sn	cmfk1zwv30020a8k65nl66nei	3	cmfk1se5b000noamupixwxn1e	cmfk1su6z002noamuy2ideni1	cmfk1sbe9000boamu2df41jg2	cmfk1sowd001zoamuvf151dqr	\N	\N	\N	f	\N	\N	\N	2025-10-02 19:00:00	cmfk1sbaz0009oamu2b4d3hvn	\N	{cmfk1sbaz0009oamu2b4d3hvn}	DATE_PROPOSED	2025-09-14 18:55:35.523	2025-10-02 10:38:32.019	\N	\N	\N
cmfk22b2u000f14gfe43tv6fw	cmfk1zwyw002ka8k6r8hvqamt	3	cmfk1sfxf000voamuhd2jlcwe	cmfk1skd8001foamu7ou1ahaw	cmfk1srkb002boamu9y56r9bd	cmfk1sgu1000zoamuu2rz8wvi	4	1	\N	t	cmfk1srkb002boamu9y56r9bd	cmfk1skd8001foamu7ou1ahaw	\N	2025-09-18 19:00:00	cmfbozhi7000010usvdlkdp76	2025-09-18 19:00:00	{cmfk1sfua000toamucpb629uz,cmfk1sgqw000xoamuyro00l3t,cmfk1ska3001doamudf88m6lz,cmfk1srgy0029oamueuwhgoea,cmfbozhi7000010usvdlkdp76}	SCHEDULED	2025-09-14 18:55:35.574	2025-09-18 20:50:17.044	\N	\N	\N
\.


--
-- TOC entry 3473 (class 0 OID 139311)
-- Dependencies: 220
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.players (id, "userId", name, "notificationsReadAt") FROM stdin;
cmfk1sbe9000boamu2df41jg2	cmfk1sbaz0009oamu2b4d3hvn	Adrian Ares	\N
cmfk1scaj000foamubym5sipp	cmfk1sc7c000doamu862exso2	Chadri	\N
cmfk1se5b000noamupixwxn1e	cmfk1se21000loamuelu7hvc0	Alonso	\N
cmfk1shr10013oamu22yhglpk	cmfk1shnr0011oamuv1qpl04y	Chemi	\N
cmfk1skd8001foamu7ou1ahaw	cmfk1ska3001doamudf88m6lz	Ethan	\N
cmfk1sld0001joamufq0zhnf4	cmfk1sl9v001hoamugxbzks16	Iñigo	\N
cmfk1sma1001noamu9u7dajci	cmfk1sm6w001loamuhgqmxcfe	Javi Ostolaza	\N
cmfk1sn4z001roamuw3z0efwe	cmfk1sn1u001poamurr2hrlcd	Pekas	\N
cmfk1snzi001voamuf1dcdtav	cmfk1snw6001toamudjm9kx2n	Jose	\N
cmfk1sowd001zoamuvf151dqr	cmfk1sot9001xoamu8699fj0g	Josu	\N
cmfk1srkb002boamu9y56r9bd	cmfk1srgy0029oamueuwhgoea	David Rubio	\N
cmfk1ssgz002foamusz7sdg4n	cmfk1ssdv002doamugbok4rlj	Sendoa	\N
cmfk1su6z002noamuy2ideni1	cmfk1su3u002loamu4q4ac05o	Tojel	\N
cmfk1sqov0027oamuan625w73	cmfk1sqll0025oamumqdamlun	Pablo Palacios	2025-09-18 17:17:14.451+00
cmfk1sgu1000zoamuu2rz8wvi	cmfk1sgqw000xoamuyro00l3t	K-Style	2025-09-18 20:33:38.231+00
cmfk1sagz0007oamu036pcw9b	cmfk1sadr0005oamublcpsauj	Jaime	2025-09-18 21:05:09.084+00
cmfk1sfxf000voamuhd2jlcwe	cmfk1sfua000toamucpb629uz	Bertucu	2025-09-22 13:41:57.17+00
cmfk1s9fh0003oamu0eas10b9	cmfk1s98y0001oamu3c7kkxx6	Cesar Veci	2025-09-29 18:19:06.713+00
cmfk1ste2002joamub3kmmodh	cmfk1staw002hoamug1o0s6us	Sergio Lopez	2025-09-29 19:00:20.476+00
cmfk1sf0z000roamu0ggralx2	cmfk1sexh000poamudlgrlzf8	Alvaro Solana	2025-09-30 21:41:39.635+00
cmfk1spt70023oamuf8qs2haa	cmfk1spq10021oamu8j7koei6	Manu F.	2025-10-02 11:00:31.631+00
cmfk1sinh0017oamue0zyobe2	cmfk1sikc0015oamuq2lzfs4d	Dani	2025-10-06 16:07:15.716+00
cmfk1sd7y000joamuz4ue29rx	cmfk1sd4u000hoamuoknlp8e4	Alejandro Arce	2025-10-06 17:40:55.753+00
cmfk1sjj4001boamuoskjjwch	cmfk1sjfw0019oamuvywlft1j	Eric	2025-10-06 18:59:14.479+00
\.


--
-- TOC entry 3480 (class 0 OID 139372)
-- Dependencies: 227
-- Data for Name: rankings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rankings (id, "tournamentId", "playerId", "roundNumber", "totalPoints", "roundsPlayed", "averagePoints", "position", "ironmanPosition", movement) FROM stdin;
\.


--
-- TOC entry 3475 (class 0 OID 139328)
-- Dependencies: 222
-- Data for Name: rounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rounds (id, "tournamentId", number, "startDate", "endDate", "isClosed", "createdAt", "updatedAt") FROM stdin;
cmfk1zana001da8k6jrx8bgmd	cmfbpafmm0000c0qr615njjm9	7	2025-12-15 00:00:00	2025-12-29 00:00:00	f	2025-09-14 18:53:15.046	2025-09-14 18:53:15.046
cmfbpafow0006c0qrs8bwl6k1	cmfbpafmm0000c0qr615njjm9	3	2025-10-20 00:00:00	2025-11-03 00:00:00	f	2025-09-08 22:35:50.385	2025-09-08 22:35:50.385
cmfbpafq9000cc0qr27ilmd5k	cmfbpafmm0000c0qr615njjm9	6	2025-12-01 00:00:00	2025-12-15 00:00:00	f	2025-09-08 22:35:50.433	2025-09-08 22:35:50.433
cmfbpafpd0008c0qr8avbhxmx	cmfbpafmm0000c0qr615njjm9	4	2025-11-03 00:00:00	2025-11-17 00:00:00	f	2025-09-08 22:35:50.401	2025-09-08 22:35:50.401
cmfbpafpt000ac0qr3ie0qqsl	cmfbpafmm0000c0qr615njjm9	5	2025-11-17 00:00:00	2025-12-01 00:00:00	f	2025-09-08 22:35:50.417	2025-09-08 22:35:50.417
cmfbpafni0002c0qry7rzngif	cmfbpafmm0000c0qr615njjm9	1	2025-09-15 00:00:00	2025-10-07 00:00:00	f	2025-09-08 22:35:50.335	2025-09-08 22:35:50.335
cmfbpafog0004c0qrmqxmhn7w	cmfbpafmm0000c0qr615njjm9	2	2025-10-07 00:00:00	2025-10-20 00:00:00	f	2025-09-08 22:35:50.368	2025-09-08 22:35:50.368
\.


--
-- TOC entry 3481 (class 0 OID 139446)
-- Dependencies: 228
-- Data for Name: streak_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.streak_history (id, "playerId", "roundId", "groupId", "streakType", "streakCount", "bonusPoints", "createdAt") FROM stdin;
\.


--
-- TOC entry 3474 (class 0 OID 139318)
-- Dependencies: 221
-- Data for Name: tournament_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_players (id, "tournamentId", "playerId", "joinedRound", "comodinesUsed", "substituteAppearances") FROM stdin;
cmfk1y12h0001a8k6bkiowdyk	cmfbpafmm0000c0qr615njjm9	cmfk1sbe9000boamu2df41jg2	1	0	0
cmfk1y13u0003a8k6jqk46wfn	cmfbpafmm0000c0qr615njjm9	cmfk1sd7y000joamuz4ue29rx	1	0	0
cmfk1y14s0005a8k6zt1ghfvk	cmfbpafmm0000c0qr615njjm9	cmfk1se5b000noamupixwxn1e	1	0	0
cmfk1y15r0007a8k6tmwemals	cmfbpafmm0000c0qr615njjm9	cmfk1sf0z000roamu0ggralx2	1	0	0
cmfk1y16w0009a8k6k0ytapx5	cmfbpafmm0000c0qr615njjm9	cmfk1sfxf000voamuhd2jlcwe	1	0	0
cmfk1y17u000ba8k6bjdxd5ss	cmfbpafmm0000c0qr615njjm9	cmfk1s9fh0003oamu0eas10b9	1	0	0
cmfk1y18s000da8k6siwthrl4	cmfbpafmm0000c0qr615njjm9	cmfk1scaj000foamubym5sipp	1	0	0
cmfk1y19q000fa8k6z16z7u9v	cmfbpafmm0000c0qr615njjm9	cmfk1shr10013oamu22yhglpk	1	0	0
cmfk1y1ao000ha8k6xk7cwf7b	cmfbpafmm0000c0qr615njjm9	cmfk1sinh0017oamue0zyobe2	1	0	0
cmfk1y1bl000ja8k6cuwcq7hz	cmfbpafmm0000c0qr615njjm9	cmfk1srkb002boamu9y56r9bd	1	0	0
cmfk1y1cj000la8k6d8p86qte	cmfbpafmm0000c0qr615njjm9	cmfk1sjj4001boamuoskjjwch	1	0	0
cmfk1y1dm000na8k6gpnjorio	cmfbpafmm0000c0qr615njjm9	cmfk1skd8001foamu7ou1ahaw	1	0	0
cmfk1y1ek000pa8k6l34oq3cv	cmfbpafmm0000c0qr615njjm9	cmfk1sld0001joamufq0zhnf4	1	0	0
cmfk1y1fj000ra8k6u5m3b6j6	cmfbpafmm0000c0qr615njjm9	cmfk1sagz0007oamu036pcw9b	1	0	0
cmfk1y1gh000ta8k6qv9rc577	cmfbpafmm0000c0qr615njjm9	cmfk1sma1001noamu9u7dajci	1	0	0
cmfk1y1hf000va8k66d8xklyk	cmfbpafmm0000c0qr615njjm9	cmfk1snzi001voamuf1dcdtav	1	0	0
cmfk1y1ii000xa8k6xevlrihc	cmfbpafmm0000c0qr615njjm9	cmfk1sowd001zoamuvf151dqr	1	0	0
cmfk1y1jh000za8k6sv30p536	cmfbpafmm0000c0qr615njjm9	cmfk1sgu1000zoamuu2rz8wvi	1	0	0
cmfk1y1kf0011a8k64dd6rxtw	cmfbpafmm0000c0qr615njjm9	cmfk1spt70023oamuf8qs2haa	1	0	0
cmfk1y1ld0013a8k64dkmf5mz	cmfbpafmm0000c0qr615njjm9	cmfk1sqov0027oamuan625w73	1	0	0
cmfk1y1ma0015a8k6ot3mdouc	cmfbpafmm0000c0qr615njjm9	cmfk1sn4z001roamuw3z0efwe	1	0	0
cmfk1y1n80017a8k6xdefay6i	cmfbpafmm0000c0qr615njjm9	cmfk1ssgz002foamusz7sdg4n	1	0	0
cmfk1y1o60019a8k6q8q7oigr	cmfbpafmm0000c0qr615njjm9	cmfk1ste2002joamub3kmmodh	1	0	0
cmfk1y1pa001ba8k6tnejn8wk	cmfbpafmm0000c0qr615njjm9	cmfk1su6z002noamuy2ideni1	1	0	0
\.


--
-- TOC entry 3472 (class 0 OID 139296)
-- Dependencies: 219
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournaments (id, title, "startDate", "endDate", "totalRounds", "roundDurationDays", "isActive", "isPublic", "createdAt", "updatedAt", "maxComodinesPerPlayer", "enableMeanComodin", "enableSubstituteComodin", "substituteCreditFactor", "substituteMaxAppearances", "continuityEnabled", "continuityMaxBonus", "continuityMinRounds", "continuityMode", "continuityPointsPerRound", "continuityPointsPerSet") FROM stdin;
cmfbpafmm0000c0qr615njjm9	Torneo Escalera Villa 2025	2025-09-15 00:00:00	2025-12-22 00:00:00	7	14	t	t	2025-09-08 22:35:50.302	2025-09-14 18:53:15.011	1	f	t	0.5	2	t	1	2	MATCHES	1	1
\.


--
-- TOC entry 3471 (class 0 OID 139287)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password, "isAdmin", "createdAt", "updatedAt") FROM stdin;
cmfbozhi7000010usvdlkdp76	Administrador	admin@escalapp.com	$2a$10$XfA2vAXnCO74JAoF9zwTJuelYIQSamoEFv7k63fN9VrQSRCWmn2Ka	t	2025-09-08 22:27:19.517	2025-09-08 22:27:19.517
cmfk1s98y0001oamu3c7kkxx6	Cesar Veci	Veci@villa.com	$2a$12$cXLV6LowI6YSy/idiByfQ.glbiuLNaJa7qpCv2MBewdD/StUrTdiq	f	2025-09-14 18:47:46.642	2025-09-14 18:47:46.642
cmfk1sadr0005oamublcpsauj	Jaime	Jaime@villa.com	$2a$12$YYVhxLSQYeBQyoLIpt3AZOLdzmAOKkc.B0sSa796yiUxGYmDekcXa	f	2025-09-14 18:47:48.112	2025-09-14 18:47:48.112
cmfk1sbaz0009oamu2b4d3hvn	Adrian Ares	AdrianAres@villa.com	$2a$12$gMVUAN5sgp1vInmW6vuJWuuRBtFXhqJamqIV2KsIk983q5Sf4yg2q	f	2025-09-14 18:47:49.307	2025-09-14 18:47:49.307
cmfk1sc7c000doamu862exso2	Chadri	Chadri@villa.com	$2a$12$//sjHsInupElSZ6EcWecrudEbfuXGYdh9S0tLuiauNRF0WQk2uCvW	f	2025-09-14 18:47:50.473	2025-09-14 18:47:50.473
cmfk1sd4u000hoamuoknlp8e4	Alejandro Arce	AlejandroArce@villa.com	$2a$12$r7KsS52bS0v95Fee3pUI5e4s60.B1oPpBWRkVWE3/BW79jfQfhyVW	f	2025-09-14 18:47:51.678	2025-09-14 18:47:51.678
cmfk1se21000loamuelu7hvc0	Alonso	Alonso@villa.com	$2a$12$puNjkASkcv.p0pdF2RFmMOVpXZOelRnAsRHEGiYjjh0AbPNZekSK2	f	2025-09-14 18:47:52.873	2025-09-14 18:47:52.873
cmfk1sexh000poamudlgrlzf8	Alvaro Solana	AlvaroSolana@villa.com	$2a$12$WzciMErOj3df2pMV/2C/xuo6QN9N8uCUerJI6Ks3K6D.XmVw8hCiC	f	2025-09-14 18:47:54.006	2025-09-14 18:47:54.006
cmfk1sfua000toamucpb629uz	Bertucu	Bertucu@villa.com	$2a$12$Y7pSCZ68kU3V9r5n9hm48eAntNlhK3v3Dk3NUYHpOa8n7gOpaUAL2	f	2025-09-14 18:47:55.186	2025-09-14 18:47:55.186
cmfk1sgqw000xoamuyro00l3t	K-Style	K-Style@villa.com	$2a$12$y1udK7xxsf8uF3VNan8IJOhVTzrqsoTmb1wFyTOrC/GPenetMx4oG	f	2025-09-14 18:47:56.361	2025-09-14 18:47:56.361
cmfk1shnr0011oamuv1qpl04y	Chemi	Chemi@villa.com	$2a$12$ebgES/HfnmGtpgxNChDDoONXqjJ1O7ELTbAbPwWUhqMT6Z8BffVO6	f	2025-09-14 18:47:57.544	2025-09-14 18:47:57.544
cmfk1sikc0015oamuq2lzfs4d	Dani	Dani@villa.com	$2a$12$padX5RXxfKlGK3xIAmqMIuRn9J7HuBy8OfvvUYK6Tk7D7o9DWATFO	f	2025-09-14 18:47:58.716	2025-09-14 18:47:58.716
cmfk1sjfw0019oamuvywlft1j	Eric	Eric@villa.com	$2a$12$mw3Dj/ivxgToAUilny7XDO2KoQUOiokKIW2GB.qUd2wu/IxnmxH4G	f	2025-09-14 18:47:59.853	2025-09-14 18:47:59.853
cmfk1ska3001doamudf88m6lz	Ethan	Ethan@villa.com	$2a$12$NzCcwz6l0KckLjsKDstfieL8QCxMbJTTGt9qW3S.cQ7r4WNJSdZ8y	f	2025-09-14 18:48:00.939	2025-09-14 18:48:00.939
cmfk1sm6w001loamuhgqmxcfe	Javi Ostolaza	JaviOstolaza@villa.com	$2a$12$u3Vc20xkIB4H1q5ktx04re5icT/vl8CKHlvj41HdMQ6RUiBzhs4Ye	f	2025-09-14 18:48:03.416	2025-09-14 18:48:03.416
cmfk1sn1u001poamurr2hrlcd	Pekas	Pekas@villa.com	$2a$12$na7qc9/LYhjB672l60xdS.fe4C.uYMWdLcJiQCbWdt9UitCS3YE76	f	2025-09-14 18:48:04.53	2025-09-14 18:48:04.53
cmfk1snw6001toamudjm9kx2n	Jose	Jose@villa.com	$2a$12$zhvMGdROy21.Oo2jUPehMOCK8kR4AYTajBHq9ZxOTJjfIXkDhkhV2	f	2025-09-14 18:48:05.622	2025-09-14 18:48:05.622
cmfk1sot9001xoamu8699fj0g	Josu	Josu@villa.com	$2a$12$Jgnn9fmvySi8tDc9CgZlROoFwuXYZMaXsx8gDVRg2sIUxU11BbwL2	f	2025-09-14 18:48:06.813	2025-09-14 18:48:06.813
cmfk1spq10021oamu8j7koei6	Manu F.	ManuF.@villa.com	$2a$12$V/1a0lVUyt4OpvPBQUQnaO01gbO4Ertj5yfeEzLiT3J6Hku7ypN.K	f	2025-09-14 18:48:07.993	2025-09-14 18:48:07.993
cmfk1sqll0025oamumqdamlun	Pablo Palacios	PabloPalacios@villa.com	$2a$12$i.ZGTkE0ZRziZlr2QQfO2uYR59SHn4Hgpcd7VQXWUC5aIhaPpwi6y	f	2025-09-14 18:48:09.129	2025-09-14 18:48:09.129
cmfk1srgy0029oamueuwhgoea	David Rubio	DavidRubio@villa.com	$2a$12$QUx11/5wDen2Mbsk4WUT3O/DzosfFrF3/mWFiJr6zjEES5BiuS8X2	f	2025-09-14 18:48:10.259	2025-09-14 18:48:10.259
cmfk1ssdv002doamugbok4rlj	Sendoa	Sendoa@villa.com	$2a$12$ejKCgad0uxGEnhzMS7wxbuw.ZzhauUaLv1HdabMFuTM.CAVr6w8qe	f	2025-09-14 18:48:11.443	2025-09-14 18:48:11.443
cmfk1staw002hoamug1o0s6us	Sergio Lopez	SergioLopez@villa.com	$2a$12$ul24IMIMMgwRczTnVwUpUOd.ckXgWeKIfV01osYBrzCBZc0pFibqO	f	2025-09-14 18:48:12.632	2025-09-14 18:48:12.632
cmfk1su3u002loamu4q4ac05o	Tojel	Tojel@villa.com	$2a$12$7W1GH4.A4404NjlNlr7cYO6oNlLxoxHuOUumqPe5ueQMDgBicPrzG	f	2025-09-14 18:48:13.674	2025-09-14 18:48:13.674
cmfk5aghd0000t92soms10d4a	Alberto Talledo gallego	atalledogallego@gmail.com	$2a$12$9uCrwqpdvxCU.ilev/TdqeK35c24Qy7dXSRdLzl6otXQ1YfbBGyA2	f	2025-09-14 20:25:54.674	2025-09-14 20:25:54.674
cmfk5d4gx0000wcgq2r12owdd	Jorge Rodríguez	jorgepks00@gmail.com	$2a$12$HjdTu/9G9aYR7pUvSOylGuL1yTGNRliPzKWeU.Sqb6g8qity27LRi	f	2025-09-14 20:27:59.074	2025-09-14 20:27:59.074
cmfk5vgoa0000p5wbpdghoihj	Jose Manuel	urquiza_jm@hotmail.con	$2a$12$eNY3eIqk3RsWmXMWWlJwWeQzDe7sWTIbpLv/zsOf2xt.8nTqbLvcK	f	2025-09-14 20:42:14.698	2025-09-14 20:42:14.698
cmfk1sl9v001hoamugxbzks16	Iñigo	Inigo@villa.com	$2a$12$3n9Ea70hi5Yi3S0GGJOm1ezFYuIYCKBttv4M4gW4cKRwSefCZr422	f	2025-09-14 18:48:02.227	2025-09-14 18:48:02.227
cmfkr47uo0000ctz12307dz9d	Alejandro	futbolero0402@gmail.com	$2a$12$V5VwLegPGoJnXv2P6KZzTeGttHPVRtq1HFDREe.tByfCSW45hZaK.	f	2025-09-15 06:36:55.105	2025-09-15 06:36:55.105
cmfm8ho260000bjl0pekdms6f	Eric Alvarado Salgueiro	eric.alvarado89@gmail.com	$2a$12$MmlkMgI6v1ZefvvSkEw6v.ur4SkiZtPdg81OaoLHdfcHbk9QWj3.G	f	2025-09-16 07:31:02.287	2025-09-16 07:31:02.287
\.


--
-- TOC entry 3269 (class 2606 OID 139272)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3297 (class 2606 OID 139353)
-- Name: group_players group_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_players
    ADD CONSTRAINT group_players_pkey PRIMARY KEY (id);


--
-- TOC entry 3291 (class 2606 OID 139343)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3306 (class 2606 OID 139371)
-- Name: match_results match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_pkey PRIMARY KEY (id);


--
-- TOC entry 3303 (class 2606 OID 139364)
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- TOC entry 3280 (class 2606 OID 139317)
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- TOC entry 3308 (class 2606 OID 139378)
-- Name: rankings rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings
    ADD CONSTRAINT rankings_pkey PRIMARY KEY (id);


--
-- TOC entry 3287 (class 2606 OID 139336)
-- Name: rounds rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_pkey PRIMARY KEY (id);


--
-- TOC entry 3311 (class 2606 OID 139453)
-- Name: streak_history streak_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT streak_history_pkey PRIMARY KEY (id);


--
-- TOC entry 3283 (class 2606 OID 139327)
-- Name: tournament_players tournament_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT tournament_players_pkey PRIMARY KEY (id);


--
-- TOC entry 3277 (class 2606 OID 139310)
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- TOC entry 3274 (class 2606 OID 139295)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3293 (class 1259 OID 139384)
-- Name: group_players_groupId_playerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "group_players_groupId_playerId_key" ON public.group_players USING btree ("groupId", "playerId");


--
-- TOC entry 3294 (class 1259 OID 155649)
-- Name: group_players_groupId_points_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "group_players_groupId_points_idx" ON public.group_players USING btree ("groupId", points);


--
-- TOC entry 3295 (class 1259 OID 139385)
-- Name: group_players_groupId_position_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "group_players_groupId_position_key" ON public.group_players USING btree ("groupId", "position");


--
-- TOC entry 3298 (class 1259 OID 155648)
-- Name: group_players_playerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "group_players_playerId_idx" ON public.group_players USING btree ("playerId");


--
-- TOC entry 3292 (class 1259 OID 139383)
-- Name: groups_roundId_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "groups_roundId_number_key" ON public.groups USING btree ("roundId", number);


--
-- TOC entry 3304 (class 1259 OID 139387)
-- Name: match_results_matchId_playerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "match_results_matchId_playerId_key" ON public.match_results USING btree ("matchId", "playerId");


--
-- TOC entry 3299 (class 1259 OID 139386)
-- Name: matches_groupId_setNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "matches_groupId_setNumber_key" ON public.matches USING btree ("groupId", "setNumber");


--
-- TOC entry 3300 (class 1259 OID 155650)
-- Name: matches_groupId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "matches_groupId_status_idx" ON public.matches USING btree ("groupId", status);


--
-- TOC entry 3301 (class 1259 OID 155651)
-- Name: matches_isConfirmed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "matches_isConfirmed_idx" ON public.matches USING btree ("isConfirmed");


--
-- TOC entry 3281 (class 1259 OID 139380)
-- Name: players_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "players_userId_key" ON public.players USING btree ("userId");


--
-- TOC entry 3309 (class 1259 OID 139388)
-- Name: rankings_tournamentId_playerId_roundNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "rankings_tournamentId_playerId_roundNumber_key" ON public.rankings USING btree ("tournamentId", "playerId", "roundNumber");


--
-- TOC entry 3285 (class 1259 OID 155653)
-- Name: rounds_isClosed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rounds_isClosed_idx" ON public.rounds USING btree ("isClosed");


--
-- TOC entry 3288 (class 1259 OID 155652)
-- Name: rounds_tournamentId_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rounds_tournamentId_number_idx" ON public.rounds USING btree ("tournamentId", number);


--
-- TOC entry 3289 (class 1259 OID 139382)
-- Name: rounds_tournamentId_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "rounds_tournamentId_number_key" ON public.rounds USING btree ("tournamentId", number);


--
-- TOC entry 3284 (class 1259 OID 139381)
-- Name: tournament_players_tournamentId_playerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "tournament_players_tournamentId_playerId_key" ON public.tournament_players USING btree ("tournamentId", "playerId");


--
-- TOC entry 3275 (class 1259 OID 155654)
-- Name: tournaments_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tournaments_isActive_idx" ON public.tournaments USING btree ("isActive");


--
-- TOC entry 3278 (class 1259 OID 155655)
-- Name: tournaments_startDate_endDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tournaments_startDate_endDate_idx" ON public.tournaments USING btree ("startDate", "endDate");


--
-- TOC entry 3270 (class 1259 OID 155656)
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- TOC entry 3271 (class 1259 OID 139379)
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- TOC entry 3272 (class 1259 OID 155657)
-- Name: users_isAdmin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_isAdmin_idx" ON public.users USING btree ("isAdmin");


--
-- TOC entry 3317 (class 2606 OID 139414)
-- Name: group_players group_players_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_players
    ADD CONSTRAINT "group_players_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3318 (class 2606 OID 139419)
-- Name: group_players group_players_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_players
    ADD CONSTRAINT "group_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3316 (class 2606 OID 139409)
-- Name: groups groups_roundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT "groups_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES public.rounds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3321 (class 2606 OID 139434)
-- Name: match_results match_results_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT "match_results_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3319 (class 2606 OID 139424)
-- Name: matches matches_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT "matches_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3320 (class 2606 OID 139429)
-- Name: matches matches_proposedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT "matches_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3312 (class 2606 OID 139389)
-- Name: players players_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3315 (class 2606 OID 139404)
-- Name: rounds rounds_tournamentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT "rounds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES public.tournaments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3322 (class 2606 OID 139464)
-- Name: streak_history streak_history_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT "streak_history_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3323 (class 2606 OID 139454)
-- Name: streak_history streak_history_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT "streak_history_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3324 (class 2606 OID 139459)
-- Name: streak_history streak_history_roundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT "streak_history_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES public.rounds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3313 (class 2606 OID 139394)
-- Name: tournament_players tournament_players_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT "tournament_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3314 (class 2606 OID 139399)
-- Name: tournament_players tournament_players_tournamentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT "tournament_players_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES public.tournaments(id) ON UPDATE CASCADE ON DELETE CASCADE;


-- Completed on 2025-10-06 23:03:19

--
-- PostgreSQL database dump complete
--

\unrestrict ngzNYRkQPeRsv0VUF1GVaSUXzWgWzKdj7Xvzmcr3EIWBtfBIkC8EqQp8yBazP2d

