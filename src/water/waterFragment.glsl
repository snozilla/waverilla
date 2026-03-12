uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uWaterColor;
uniform vec3 uWaterDeepColor;
uniform samplerCube uEnvMap;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

#define PI 3.14159265359

// Simple noise for foam
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec3 normal = normalize(vNormal);

    // Scrolling normal perturbation
    vec2 uv1 = vWorldPos.xz * 0.05 + uTime * 0.02;
    vec2 uv2 = vWorldPos.xz * 0.08 - uTime * 0.015;
    float n1 = noise(uv1 * 8.0);
    float n2 = noise(uv2 * 10.0);
    normal.xz += (n1 - 0.5) * 0.15 + (n2 - 0.5) * 0.1;
    normal = normalize(normal);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Fresnel
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
    fresnel = mix(0.02, 1.0, fresnel);

    // Reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflectionColor = vec3(0.5, 0.7, 0.9); // fallback sky color
    #ifdef USE_ENVMAP
      reflectionColor = textureCube(uEnvMap, reflectDir).rgb;
    #endif

    // Water color with depth
    float depthFactor = smoothstep(-3.0, 1.0, vWorldPos.y);
    vec3 waterColor = mix(uWaterDeepColor, uWaterColor, depthFactor);

    // Specular sun glint
    vec3 halfDir = normalize(viewDir + uSunDirection);
    float spec = pow(max(dot(normal, halfDir), 0.0), 256.0);
    vec3 specular = vec3(1.0, 0.95, 0.8) * spec * 2.0;

    // Foam on peaks
    float foam = smoothstep(0.7, 1.5, vWorldPos.y);
    foam *= noise(vWorldPos.xz * 2.0 + uTime * 0.5) * 0.8 + 0.2;

    // Combine
    vec3 color = mix(waterColor, reflectionColor, fresnel);
    color += specular;
    color = mix(color, vec3(0.9, 0.95, 1.0), foam * 0.6);

    // Subsurface scattering approximation
    float sss = pow(max(dot(viewDir, -uSunDirection), 0.0), 4.0);
    sss *= max(0.0, normal.y) * 0.3;
    color += vec3(0.0, 0.5, 0.4) * sss;

    gl_FragColor = vec4(color, 0.92);
}
