// Redes suportadas pela publicação do Leonardo. Fonte única para validação, lote e calendário.
export const PLATFORMS=['Instagram','Facebook','Threads','X','LinkedIn'];
// Limites conservadores de texto por rede (caracteres).
export const TEXT_LIMITS={Instagram:2200,Facebook:5000,Threads:500,X:280,LinkedIn:3000};
// Redes em que a foto é enviada nesta versão. X e LinkedIn recebem só o texto.
export const MEDIA_PLATFORMS=['Instagram','Facebook','Threads'];
// Instagram não publica sem imagem.
export const MEDIA_REQUIRED=['Instagram'];
export const PLATFORM_PROVIDER={Instagram:'instagram',Facebook:'facebook',Threads:'threads',X:'x',LinkedIn:'linkedin'};
