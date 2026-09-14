/**
 * Un bloc JSON-LD, rendu côté serveur dans le HTML de la page.
 *
 * `<` est échappé : un titre de challenge ou de sandbox est saisi par un
 * utilisateur, et `</script>` dans une chaîne fermerait la balise.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
