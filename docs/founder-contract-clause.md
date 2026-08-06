# Cláusula de Cliente Fundador — texto de referencia

Contexto: P-75 introdujo la "Oferta Fundadores" (setup $0, mensualidad congelada al precio de lista) para los primeros 10 clientes totales, en cualquiera de los 5 paquetes. `coimagen-os` no tiene un motor de plantillas de contrato — los contratos (`contracts/[id].tsx`) tienen campos `content`/`terms` de texto libre que la persona que da de alta el contrato escribe a mano. Este documento es solo referencia para copiar/pegar; no hay integración automática.

Al redactar el contrato de onboarding de un cliente fundador, incluir ambos puntos siguientes.

## 1. Numeración de cliente fundador

**ES:**
> Este contrato corresponde al Cliente Fundador número **[N] de 10**. El precio fundador (configuración inicial $0 y mensualidad congelada al precio de lista vigente al momento de la firma) aplica exclusivamente a los primeros 10 clientes fundadores de Coimagen Media Agency, sin importar el paquete contratado.

**EN:**
> This contract corresponds to Founder Client number **[N] of 10**. Founder pricing ($0 setup fee and monthly price locked at the list price in effect at signing) applies exclusively to Coimagen Media Agency's first 10 founder clients, regardless of package.

## 2. Cláusula de testimonio

**ES:**
> Como contraprestación por el precio fundador, el cliente acepta proporcionar un testimonio (escrito, en video, o ambos) sobre su experiencia con Coimagen Media Agency, utilizable con fines de mercadotecnia (sitio web, redes sociales, materiales de ventas), dentro de los primeros [X] días posteriores a la implementación del servicio.

**EN:**
> In exchange for founder pricing, the client agrees to provide a testimonial (written, video, or both) about their experience with Coimagen Media Agency, usable for marketing purposes (website, social media, sales materials), within the first [X] days following service implementation.

## Notas

- Sustituir `[N]` por el número de orden real (contar contratos fundadores previamente firmados; no hay contador automático en el sistema — llevar la cuenta manualmente).
- Sustituir `[X]` con el plazo que Camila defina; no se especificó en el ticket original.
- El texto público en el sitio (paquetes, oferta fundadores) solo dice "Aplican términos y condiciones" — el detalle completo vive únicamente en este contrato, no en la página pública.
- Cuando se firme el contrato del cliente fundador #10, la oferta se da por terminada: actualizar `founderSpotsAvailable` a `0` en el panel `/admin` de coimagen-media-web (pestaña "Fundadores") para que deje de mostrarse en el sitio.
