import { withEve } from "eve/next";
import type { NextConfig } from "next";

/**
 * Intestazioni di sicurezza. Next non ne mette nessuna di suo.
 *
 * Nota sulla CSP: non c'e' una `script-src` restrittiva perche' Next inietta
 * script inline per l'idratazione e per next-themes; una CSP scritta a meta'
 * da' l'illusione della protezione. Qui restano i vincoli che valgono davvero
 * senza rompere il framework — il resto va stretto quando si sceglie una
 * strategia di nonce.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Il microfono serve al concierge: e' l'unico permesso concesso.
    value: "camera=(), geolocation=(), microphone=(self), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// withEve fa convivere Next e l'agente eve in un solo progetto e monta le
// rotte del protocollo su /eve/v1/**, same-origin.
export default withEve(nextConfig);
