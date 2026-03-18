INSERT INTO system_credentials (env_key, name, description, value) VALUES
  ('DISCORD_WEBHOOK_URL', 'Discord Webhook URL', 'URL do webhook para alertas de vendas e falhas no Discord', 'https://discord.com/api/webhooks/1483836063582519326/aPpaJdcHQIYkJndpzge2-Peld68rkrJLK2XNPXZSUxjR8okiXkoIr-4dXbHx0ukjXrzh'),
  ('DISCORD_GUILD_ID', 'Discord Guild ID', 'ID do servidor Discord para atribuição de cargos', '1476804157611704412'),
  ('DISCORD_CLIENT_ROLE_ID', 'Discord Client Role ID', 'ID do cargo Cliente no Discord', '1476805816639291434')
ON CONFLICT DO NOTHING;