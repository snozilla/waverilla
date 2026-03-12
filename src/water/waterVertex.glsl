uniform float uTime;
uniform float uAmplitudes[6];
uniform float uWavelengths[6];
uniform float uSpeeds[6];
uniform vec2  uDirections[6];
uniform float uSteepnesses[6];

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

#define PI 3.14159265359

vec3 gerstnerWave(vec2 dir, float amplitude, float wavelength, float speed, float steepness, vec2 pos, float time) {
    float k = 2.0 * PI / wavelength;
    float c = speed / k;
    float f = k * (dot(dir, pos) - c * time);
    float a = steepness / k;

    return vec3(
        dir.x * a * cos(f),
        amplitude * sin(f),
        dir.y * a * cos(f)
    );
}

void main() {
    vUv = uv;
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    for (int i = 0; i < 6; i++) {
        vec2 dir = normalize(uDirections[i]);
        float k = 2.0 * PI / uWavelengths[i];
        float c = uSpeeds[i] / k;
        float f = k * (dot(dir, pos.xz) - c * uTime);
        float a = uSteepnesses[i] / k;
        float amp = uAmplitudes[i];

        pos.x += dir.x * a * cos(f);
        pos.y += amp * sin(f);
        pos.z += dir.y * a * cos(f);

        // tangent
        tangent.x -= dir.x * dir.x * uSteepnesses[i] * sin(f);
        tangent.y += dir.x * amp * k * cos(f);
        tangent.z -= dir.x * dir.y * uSteepnesses[i] * sin(f);

        // binormal
        binormal.x -= dir.x * dir.y * uSteepnesses[i] * sin(f);
        binormal.y += dir.y * amp * k * cos(f);
        binormal.z -= dir.y * dir.y * uSteepnesses[i] * sin(f);
    }

    vNormal = normalize(cross(binormal, tangent));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
