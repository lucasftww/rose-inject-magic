
DO $$
DECLARE
  _users uuid[] := ARRAY[
    'e939ee3c-a5f2-42e6-bdf1-2b4525457c91',
    'e1eec238-d3df-4c38-8224-4333684df206',
    'd88fd64d-ec37-4b57-986a-dff9cc8d0233',
    '39c7eefa-5610-4c03-bc07-f7b228a4eec2',
    'c7935910-69b5-4b6a-a492-bcd0d0eeb660',
    '110a4bee-4deb-4ba8-9f68-5d3342e2785e',
    '1c56420f-0641-4799-ba84-6bba85b8e179',
    'f85762ce-aff7-432f-a3d1-3b8a92e28474',
    '3f7614ca-830b-4082-8471-ab85073a127c',
    '1397c000-3bf8-437c-919c-031287996494'
  ]::uuid[];
  _product record;
  _i int;
  _user_idx int;
  _rating int;
  _comment text;
  _comments text[];
  _ts timestamptz;
BEGIN
  FOR _product IN SELECT id, name FROM products WHERE active = true LOOP
    _comments := ARRAY[
      'Produto excelente, entrega foi super rápida e funcionou de primeira',
      'Muito bom, estou usando há dias sem nenhum problema',
      'Recomendo demais, suporte respondeu minhas dúvidas na hora',
      'Funcionou perfeitamente, melhor custo-benefício que encontrei',
      'Top demais, já comprei duas vezes e sempre entregou certinho',
      'Nota 10, fácil de configurar e funciona muito bem',
      'Surpreendeu bastante, não esperava essa qualidade pelo preço',
      'Comprei com receio mas valeu cada centavo, produto de qualidade',
      'Atendimento nota mil, produto chegou rápido e sem complicação',
      'Uso diariamente, nunca deu crash nem erro nenhum',
      'Melhor investimento que fiz, jogo melhorou muito',
      'Entrega instantânea mesmo, em menos de 1 minuto já tinha acesso',
      'Funciona liso, sem travamentos e o suporte é muito atencioso',
      'Já testei outros e esse é disparado o melhor do mercado',
      'Perfeito, configuração simples e resultado impressionante'
    ];

    FOR _i IN 1..7 LOOP
      _user_idx := (abs(hashtext(_product.id::text || _i::text)) % 10) + 1;
      _rating := CASE 
        WHEN random() < 0.65 THEN 5
        WHEN random() < 0.85 THEN 4
        ELSE 3
      END;
      _comment := _comments[(abs(hashtext(_product.name || _i::text)) % 15) + 1];
      _ts := now() - (interval '1 day' * (abs(hashtext(_product.id::text || 'ts' || _i::text)) % 60 + 1));

      INSERT INTO product_reviews (product_id, user_id, rating, comment, created_at)
      VALUES (_product.id, _users[_user_idx], _rating, _comment, _ts)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
