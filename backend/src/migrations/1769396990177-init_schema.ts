import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1769396990177 implements MigrationInterface {
  name = 'InitSchema1769396990177';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc71cd6fb73f95244b23e2ef11"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."comments_status_enum" AS ENUM('pending', 'approved', 'rejected', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "content" text NOT NULL, "status" "public"."comments_status_enum" NOT NULL DEFAULT 'pending', "likes" integer NOT NULL DEFAULT '0', "parentId" uuid, "authorId" uuid, "postId" uuid, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_002eb2747d260b5b0319374ad5" ON "comments" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e7c9a36c0ac867b543c6509aa" ON "comments" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8770bd9030a3d13c5f79a7d2e8" ON "comments" ("parentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca9691fe7256d3ef5d6626c165" ON "comments" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."categories_status_enum" AS ENUM('active', 'inactive', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text, "icon" character varying, "color" character varying, "parentId" uuid, "sortOrder" integer NOT NULL DEFAULT '0', "status" "public"."categories_status_enum" NOT NULL DEFAULT 'active', "metadata" json, CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55daad89e067f87627f9f9d858" ON "categories" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a7b2c155b5bad01eb952cf2e56" ON "categories" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a6f051e66982b5f0318981bca" ON "categories" ("parentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88b5d00ccdeea13b55880af773" ON "categories" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."posts_status_enum" AS ENUM('draft', 'published', 'archived', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."posts_type_enum" AS ENUM('article', 'tutorial', 'news', 'blog')`,
    );
    await queryRunner.query(
      `CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "title" character varying NOT NULL, "content" text NOT NULL, "excerpt" character varying, "slug" character varying, "featuredImage" character varying, "status" "public"."posts_status_enum" NOT NULL DEFAULT 'draft', "type" "public"."posts_type_enum" NOT NULL DEFAULT 'article', "views" integer NOT NULL DEFAULT '0', "likes" integer NOT NULL DEFAULT '0', "tags" json, "publishedAt" TIMESTAMP, "seoTitle" character varying, "seoDescription" character varying, "metadata" json, "authorId" uuid, CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_117d314fdebad6020478d46dc2" ON "posts" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_60818528127866f5002e7f826d" ON "posts" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a129c9a63a96ac7da3d1170a6b" ON "posts" ("status", "publishedAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_54ddf9075260407dcfdd724857" ON "posts" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b16a708acb357dd119d40cc45" ON "posts" ("publishedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a69d9e2ae78ef7d100f8317ae0" ON "posts" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('bet_placement', 'bet_winning', 'bet_cancellation', 'wallet_deposit', 'wallet_withdrawal', 'staking_reward', 'staking_penalty')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'completed', 'failed', 'reversed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" character varying NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "amount" numeric(18,8) NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending', "reference_id" character varying, "related_entity_id" character varying, "metadata" json, "userId" uuid, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50b8284c5035eff589630e35ab" ON "transactions" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_450a5294dfde65588ff285fcff" ON "transactions" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5560ec7f418fed3241cddd54da" ON "transactions" ("related_entity_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_365b158cbdb7b7bc18bca4004a" ON "transactions" ("reference_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_654b237d76bfa796f383c61ea1" ON "transactions" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0a3677e1b8d83ff31f9300246" ON "transactions" ("user_id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d5fa024a84dceb158b2b95f34" ON "transactions" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da87c55b3bbbe96c6ed88ea7ee" ON "transactions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9acc6efa76de013e8c1553ed2" ON "transactions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_status_enum" AS ENUM('upcoming', 'live', 'finished', 'cancelled', 'postponed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_outcome_enum" AS ENUM('home_win', 'away_win', 'draw')`,
    );
    await queryRunner.query(
      `CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "home_team" character varying NOT NULL, "away_team" character varying NOT NULL, "start_time" TIMESTAMP NOT NULL, "status" "public"."match_status_enum" NOT NULL DEFAULT 'upcoming', "home_score" integer, "away_score" integer, "outcome" "public"."match_outcome_enum", "league" character varying, "season" character varying, "home_odds" numeric(5,2) NOT NULL DEFAULT '1.5', "draw_odds" numeric(5,2) NOT NULL DEFAULT '3', "away_odds" numeric(5,2) NOT NULL DEFAULT '2.5', "metadata" json, CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d1afbce665cbff080ac47e476" ON "matches" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3c243f0ac25405546ae19414ec" ON "matches" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_751754ff037c21990d7d636918" ON "matches" ("status", "start_time") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c84b25238f61af7beceb875b2" ON "matches" ("season") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cad66077d956e575f018199c07" ON "matches" ("league") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15001438a77d929542376352f8" ON "matches" ("start_time") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a182c2c9602fbab4e0cf680090" ON "matches" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."prediction_outcome_enum" AS ENUM('home_win', 'away_win', 'draw')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."predictions_status_enum" AS ENUM('pending', 'correct', 'incorrect', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "predictions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "match_id" uuid NOT NULL, "predicted_outcome" "public"."prediction_outcome_enum" NOT NULL, "status" "public"."predictions_status_enum" NOT NULL DEFAULT 'pending', "metadata" json, CONSTRAINT "PK_b92c9e4db595214b289f5e28adc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7b20e6c0410d1dd165c07b2576" ON "predictions" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_077a254a396cd4576e5d820c45" ON "predictions" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94dc971dc70b7c5a6cd174662d" ON "predictions" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f57c46159d1baa78a293f4192" ON "predictions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf038b973af03c3568dffd9df6" ON "predictions" ("match_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e4b27973471685734e213da97" ON "predictions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_aaac60696c99e9f901efa9ffc1" ON "predictions" ("user_id", "match_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bets_predicted_outcome_enum" AS ENUM('home_win', 'away_win', 'draw')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bets_status_enum" AS ENUM('pending', 'won', 'lost', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "match_id" uuid, "stake_amount" numeric(18,8) NOT NULL, "predicted_outcome" "public"."bets_predicted_outcome_enum" NOT NULL, "odds" numeric(5,2) NOT NULL, "potential_payout" numeric(18,8) NOT NULL, "status" "public"."bets_status_enum" NOT NULL DEFAULT 'pending', "settled_at" TIMESTAMP, "metadata" json, CONSTRAINT "PK_7ca91a6a39623bd5c21722bcedd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f7a8cdb4411b8b25ae22b1ed9b" ON "bets" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f5128b2947bdc8a7777e9c10b" ON "bets" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b7e34ea389fb44b9809147b8e" ON "bets" ("settled_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_172dcbc8441c0b4e0b6cf2c2c2" ON "bets" ("match_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fec8f395d93af19991d08ff8c9" ON "bets" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d9030891d8bdc7f30f55a69ce" ON "bets" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a8b300666e2866835f80501752" ON "bets" ("match_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e3c745e288eea6d3c9475550e" ON "bets" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_32477bab88cc96b556868e1699" ON "bets" ("user_id", "match_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "free_bet_vouchers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "amount" numeric(18,8) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "used" boolean NOT NULL DEFAULT false, "used_at" TIMESTAMP, "used_for_bet_id" character varying, "metadata" json, CONSTRAINT "PK_fa2ccf8beaa28501d4125205a3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_511989cf3361824be8e0944670" ON "free_bet_vouchers" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31607d2eda98e4a0550929c276" ON "free_bet_vouchers" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74a873959d49b84d19b399dd9f" ON "free_bet_vouchers" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6dcb1c18d356cc8129c5c37b3d" ON "free_bet_vouchers" ("user_id", "used") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_type_enum" AS ENUM('image', 'video', 'document', 'audio')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_status_enum" AS ENUM('uploading', 'processing', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "filename" character varying NOT NULL, "originalName" character varying NOT NULL, "mimeType" character varying NOT NULL, "size" bigint NOT NULL, "path" character varying NOT NULL, "url" character varying, "type" "public"."media_type_enum" NOT NULL, "status" "public"."media_status_enum" NOT NULL DEFAULT 'uploading', "metadata" json, "alt" character varying, "caption" character varying, "uploadedById" uuid, CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46cc6399e00f4d3984d5731ea4" ON "media" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c30f45ea7b47895ca14398e974" ON "media" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5ccef0fa7909c2aa707c4e2e1" ON "media" ("type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c730c2d67f271a372c39a07b7e" ON "media" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_637a0dd7f9068a9ca80decee00" ON "media" ("type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."player_card_metadata_rarity_enum" AS ENUM('common', 'uncommon', 'rare', 'epic', 'legendary')`,
    );
    await queryRunner.query(
      `CREATE TABLE "player_card_metadata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "player_id" uuid NOT NULL, "contract_address" character varying NOT NULL, "token_id" character varying NOT NULL, "token_uri" character varying NOT NULL, "player_name" character varying NOT NULL, "position" character varying, "team" character varying, "rarity" "public"."player_card_metadata_rarity_enum" NOT NULL DEFAULT 'common', "imageUrl" character varying, "season" character varying, "edition_number" integer, "total_supply" integer, "attributes" text, "description" character varying, "external_url" character varying, "isPublished" boolean NOT NULL DEFAULT true, "metadata" character varying, CONSTRAINT "PK_02767205ded542e3c5c56d6d448" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_24cad89769550b667bbdbcd846" ON "player_card_metadata" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_528b9ed19020d06443d3bb9fdd" ON "player_card_metadata" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acd65d500509dcf995efe9f1f1" ON "player_card_metadata" ("isPublished", "rarity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0260d37ed5591646a9034d598a" ON "player_card_metadata" ("season") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_edb9e84773d5fd2d2f6e71063e" ON "player_card_metadata" ("isPublished") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc3b229cf9e5b98c08cbd1d4b1" ON "player_card_metadata" ("rarity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f358da182eae80551955022b9c" ON "player_card_metadata" ("player_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_54c42ee0d536ab0dc6895086e7" ON "player_card_metadata" ("contract_address", "token_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."spin_sessions_rewardtype_enum" AS ENUM('xp', 'tokens', 'nft', 'bonus_spin', 'multiplier', 'none')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."spin_sessions_status_enum" AS ENUM('pending', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "spin_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "stakeAmount" numeric(18,8) NOT NULL, "rewardType" "public"."spin_sessions_rewardtype_enum" NOT NULL DEFAULT 'none', "rewardValue" numeric(18,8) NOT NULL DEFAULT '0', "status" "public"."spin_sessions_status_enum" NOT NULL DEFAULT 'pending', "txReference" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6e582c51c18e539aa33fea39511" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a09fcf503de651865516b519f" ON "spin_sessions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a09fcf503de651865516b519f" ON "spin_sessions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e569427205dd9bff23ced1967" ON "spin_sessions" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."spins_outcome_enum" AS ENUM('jackpot', 'high_win', 'medium_win', 'small_win', 'no_win')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."spins_status_enum" AS ENUM('pending', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "spins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "sessionId" character varying(255) NOT NULL, "stakeAmount" numeric(10,2) NOT NULL, "outcome" "public"."spins_outcome_enum" NOT NULL, "payoutAmount" numeric(10,2) NOT NULL, "status" "public"."spins_status_enum" NOT NULL DEFAULT 'pending', "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a7396ed77b9783629716ba686b7" UNIQUE ("sessionId"), CONSTRAINT "PK_097d1e3e18af6c92fa2c4197a9b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d366a5b00998df26a37baeefa" ON "spins" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7396ed77b9783629716ba686b" ON "spins" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_170b16fd8e2475de8d5ece1148" ON "spins" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "post_categories" ("category_id" uuid NOT NULL, "post_id" uuid NOT NULL, CONSTRAINT "PK_4d9e522c51f13c52ad35813cf35" PRIMARY KEY ("category_id", "post_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f6e2655c798334198182db6399" ON "post_categories" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_becbe37977577e3eeb089b69fe" ON "post_categories" ("post_id") `,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "walletAddress"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "displayName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roles"`);
    await queryRunner.query(`DROP TYPE "public"."users_roles_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "signupSource"`);
    await queryRunner.query(`DROP TYPE "public"."users_signupsource_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referralCode"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referrerId"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isEmailVerified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isWalletVerified"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kycVerified"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorEnabled"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "metadata"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "first_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatar" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'moderator', 'user')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "website" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "location" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_login_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "wallet_balance" numeric(18,8) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'suspended', 'pending')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6d596d799f9cb9dac6f7bf7c23" ON "users" ("updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c9b5b525a96ddc2c5647d7f7fa" ON "users" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf96ca0dc9c97fdc2ae06831d8" ON "users" ("email_verified") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_8770bd9030a3d13c5f79a7d2e81" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "predictions" ADD CONSTRAINT "FK_8e4b27973471685734e213da971" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "predictions" ADD CONSTRAINT "FK_bf038b973af03c3568dffd9df69" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bets" ADD CONSTRAINT "FK_8e3c745e288eea6d3c9475550e2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bets" ADD CONSTRAINT "FK_a8b300666e2866835f805017524" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "free_bet_vouchers" ADD CONSTRAINT "FK_07bc94fd9b5b2d843dc231ab473" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_4974d31d47717ebefc8b613eb27" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_card_metadata" ADD CONSTRAINT "FK_f358da182eae80551955022b9cd" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_categories" ADD CONSTRAINT "FK_f6e2655c798334198182db6399b" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_categories" ADD CONSTRAINT "FK_becbe37977577e3eeb089b69fe1" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_categories" DROP CONSTRAINT "FK_becbe37977577e3eeb089b69fe1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_categories" DROP CONSTRAINT "FK_f6e2655c798334198182db6399b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_card_metadata" DROP CONSTRAINT "FK_f358da182eae80551955022b9cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "FK_4974d31d47717ebefc8b613eb27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "free_bet_vouchers" DROP CONSTRAINT "FK_07bc94fd9b5b2d843dc231ab473"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bets" DROP CONSTRAINT "FK_a8b300666e2866835f805017524"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bets" DROP CONSTRAINT "FK_8e3c745e288eea6d3c9475550e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "predictions" DROP CONSTRAINT "FK_bf038b973af03c3568dffd9df69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "predictions" DROP CONSTRAINT "FK_8e4b27973471685734e213da971"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_8770bd9030a3d13c5f79a7d2e81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_4548cc4a409b8651ec75f70e280"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf96ca0dc9c97fdc2ae06831d8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9b5b525a96ddc2c5647d7f7fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d596d799f9cb9dac6f7bf7c23"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum_old" AS ENUM('ACTIVE', 'DELETED', 'INACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum_old" USING "status"::"text"::"public"."users_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum_old" RENAME TO "users_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "wallet_balance"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "website"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "first_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "metadata" jsonb`);
    await queryRunner.query(`ALTER TABLE "users" ADD "lastLoginAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kycVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isWalletVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "referrerId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "referralCode" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_signupsource_enum" AS ENUM('API', 'BULK_IMPORT', 'MARKETING_CAMPAIGN', 'ORGANIC', 'PARTNERSHIP', 'REFERRAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "signupSource" "public"."users_signupsource_enum" NOT NULL DEFAULT 'ORGANIC'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_roles_enum" AS ENUM('ADMIN', 'DAO', 'ORACLE', 'USER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "roles" "public"."users_roles_enum" array NOT NULL DEFAULT '{USER}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "displayName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "walletAddress" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress")`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_becbe37977577e3eeb089b69fe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f6e2655c798334198182db6399"`,
    );
    await queryRunner.query(`DROP TABLE "post_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_170b16fd8e2475de8d5ece1148"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7396ed77b9783629716ba686b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d366a5b00998df26a37baeefa"`,
    );
    await queryRunner.query(`DROP TABLE "spins"`);
    await queryRunner.query(`DROP TYPE "public"."spins_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."spins_outcome_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e569427205dd9bff23ced1967"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0a09fcf503de651865516b519f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0a09fcf503de651865516b519f"`,
    );
    await queryRunner.query(`DROP TABLE "spin_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."spin_sessions_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."spin_sessions_rewardtype_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54c42ee0d536ab0dc6895086e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f358da182eae80551955022b9c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc3b229cf9e5b98c08cbd1d4b1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_edb9e84773d5fd2d2f6e71063e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0260d37ed5591646a9034d598a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_acd65d500509dcf995efe9f1f1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_528b9ed19020d06443d3bb9fdd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_24cad89769550b667bbdbcd846"`,
    );
    await queryRunner.query(`DROP TABLE "player_card_metadata"`);
    await queryRunner.query(
      `DROP TYPE "public"."player_card_metadata_rarity_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_637a0dd7f9068a9ca80decee00"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c730c2d67f271a372c39a07b7e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f5ccef0fa7909c2aa707c4e2e1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c30f45ea7b47895ca14398e974"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46cc6399e00f4d3984d5731ea4"`,
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP TYPE "public"."media_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."media_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6dcb1c18d356cc8129c5c37b3d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74a873959d49b84d19b399dd9f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31607d2eda98e4a0550929c276"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_511989cf3361824be8e0944670"`,
    );
    await queryRunner.query(`DROP TABLE "free_bet_vouchers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32477bab88cc96b556868e1699"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e3c745e288eea6d3c9475550e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a8b300666e2866835f80501752"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d9030891d8bdc7f30f55a69ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fec8f395d93af19991d08ff8c9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_172dcbc8441c0b4e0b6cf2c2c2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b7e34ea389fb44b9809147b8e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f5128b2947bdc8a7777e9c10b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f7a8cdb4411b8b25ae22b1ed9b"`,
    );
    await queryRunner.query(`DROP TABLE "bets"`);
    await queryRunner.query(`DROP TYPE "public"."bets_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bets_predicted_outcome_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aaac60696c99e9f901efa9ffc1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e4b27973471685734e213da97"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf038b973af03c3568dffd9df6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8f57c46159d1baa78a293f4192"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94dc971dc70b7c5a6cd174662d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_077a254a396cd4576e5d820c45"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7b20e6c0410d1dd165c07b2576"`,
    );
    await queryRunner.query(`DROP TABLE "predictions"`);
    await queryRunner.query(`DROP TYPE "public"."predictions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."prediction_outcome_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a182c2c9602fbab4e0cf680090"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_15001438a77d929542376352f8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cad66077d956e575f018199c07"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c84b25238f61af7beceb875b2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_751754ff037c21990d7d636918"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3c243f0ac25405546ae19414ec"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d1afbce665cbff080ac47e476"`,
    );
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TYPE "public"."match_outcome_enum"`);
    await queryRunner.query(`DROP TYPE "public"."match_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e9acc6efa76de013e8c1553ed2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da87c55b3bbbe96c6ed88ea7ee"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d5fa024a84dceb158b2b95f34"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0a3677e1b8d83ff31f9300246"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_654b237d76bfa796f383c61ea1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_365b158cbdb7b7bc18bca4004a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5560ec7f418fed3241cddd54da"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_450a5294dfde65588ff285fcff"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50b8284c5035eff589630e35ab"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a69d9e2ae78ef7d100f8317ae0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b16a708acb357dd119d40cc45"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54ddf9075260407dcfdd724857"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a129c9a63a96ac7da3d1170a6b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_60818528127866f5002e7f826d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_117d314fdebad6020478d46dc2"`,
    );
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TYPE "public"."posts_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."posts_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88b5d00ccdeea13b55880af773"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a6f051e66982b5f0318981bca"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7b2c155b5bad01eb952cf2e56"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55daad89e067f87627f9f9d858"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "public"."categories_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca9691fe7256d3ef5d6626c165"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8770bd9030a3d13c5f79a7d2e8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e7c9a36c0ac867b543c6509aa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_002eb2747d260b5b0319374ad5"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TYPE "public"."comments_status_enum"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_fc71cd6fb73f95244b23e2ef11" ON "users" ("walletAddress") `,
    );
  }
}
