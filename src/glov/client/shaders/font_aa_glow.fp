#pragma WebGL2

precision lowp float;

varying vec2 interp_texcoord;
varying lowp vec4 interp_color;
uniform sampler2D tex0;
uniform mediump vec4 param0;
uniform vec4 glowColor;
uniform mediump vec4 glowParams;
void main()
{
  float texture0=texture2D(tex0,interp_texcoord).r;
  // Glow
  vec2 glowCoord = interp_texcoord + glowParams.xy;
  float textureGlow = texture2D(tex0, glowCoord).r;
  float t = clamp(textureGlow * glowParams.z + glowParams.w, 0.0, 1.0);
  vec4 outcolor = vec4(glowColor.xyz, t * glowColor.w);
  // Main body
  t = clamp(texture0 * param0.x + param0.y, 0.0, 1.0);
  // TODO: Do this in other shaders too!  Maybe just use pre-multiplied alpha?
  // blend color on top of glow, don't just interp
  float top_alpha = t * interp_color.a;
  float total_a = top_alpha + (1.0 - top_alpha) * outcolor.a;
  total_a = max(total_a, 0.001);
  gl_FragColor.rgb = mix(outcolor.rgb, interp_color.rgb, top_alpha / total_a);
  gl_FragColor.a = total_a;
}
