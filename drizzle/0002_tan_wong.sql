ALTER TABLE "ai_settings" ADD COLUMN "embedding_provider" "ai_provider";--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "embedding_api_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "embedding_api_key_last4" text;