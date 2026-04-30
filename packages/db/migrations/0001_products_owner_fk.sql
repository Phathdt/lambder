-- Cross-feature FK: products.owner_id → users.id (added manually to keep
-- @lambder/auth and @lambder/products schemas decoupled at the package level).
ALTER TABLE "products"
  ADD CONSTRAINT "products_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
