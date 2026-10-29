/* Reflection Lab isolated Windows C API spike; original test code.
 * Uses the official version-pinned header without copying SDK implementation.
 * Test materials are synthetic; these values are not measurements.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <phonon.h>

#define APIS(X) \
    X(iplContextCreate) X(iplContextRelease) \
    X(iplSceneCreate) X(iplSceneRelease) X(iplSceneCommit) \
    X(iplStaticMeshCreate) X(iplStaticMeshAdd) X(iplStaticMeshRelease) \
    X(iplSimulatorCreate) X(iplSimulatorRelease) X(iplSimulatorSetScene) \
    X(iplSimulatorCommit) X(iplSimulatorSetSharedInputs) \
    X(iplSimulatorRunDirect) X(iplSimulatorRunReflections) \
    X(iplSourceCreate) X(iplSourceRelease) X(iplSourceAdd) X(iplSourceRemove) \
    X(iplSourceSetInputs) X(iplSourceGetOutputs) \
    X(iplReflectionEffectCreate) X(iplReflectionEffectRelease) X(iplReflectionEffectApply)
#define DECLARE(name) static __typeof__(&name) fn_##name;
APIS(DECLARE)
#undef DECLARE

static double now_ms(void) {
    LARGE_INTEGER counter, frequency;
    QueryPerformanceCounter(&counter);
    QueryPerformanceFrequency(&frequency);
    return 1000.0 * (double)counter.QuadPart / (double)frequency.QuadPart;
}

static IPLCoordinateSpace3 coordinates(float x, float y, float z) {
    IPLCoordinateSpace3 c = {{1, 0, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 0}};
    c.origin = (IPLVector3){x, y, z};
    return c;
}

static int run_cycle(int cycle, IPLReflectionEffectType reflection_type) {
    int failed = 0, source_added = 0;
    IPLContext context = NULL;
    IPLScene scene = NULL;
    IPLStaticMesh mesh = NULL;
    IPLSimulator simulator = NULL;
    IPLSource source = NULL;
    IPLReflectionEffect reflection_effect = NULL;
    const IPLSimulationFlags flags = IPL_SIMULATIONFLAGS_DIRECT | IPL_SIMULATIONFLAGS_REFLECTIONS;
    IPLSimulationOutputs clear = {0}, blocked = {0}, reflections = {0};
    double init_start = now_ms(), init_ms = 0, direct_ms = 0, reflection_ms = 0;
    double rendered_energy = 0;
    int finite_samples = 1;
    #define CHECK(call) do { IPLerror e = (call); if (e != IPL_STATUS_SUCCESS) { \
        fprintf(stderr, "cycle %d: %s failed: %d\n", cycle, #call, (int)e); failed = 1; goto cleanup; } } while (0)
    #define EXPECT(condition, message) do { if (!(condition)) { \
        fprintf(stderr, "cycle %d assertion: %s\n", cycle, message); failed = 1; goto cleanup; } } while (0)

    IPLContextSettings context_settings = {0};
    context_settings.version = STEAMAUDIO_VERSION;
    CHECK(fn_iplContextCreate(&context_settings, &context));
    IPLSceneSettings scene_settings = {0};
    scene_settings.type = IPL_SCENETYPE_DEFAULT;
    CHECK(fn_iplSceneCreate(context, &scene_settings, &scene));

    /* 6 x 3 x 8 m shoebox, inward winding, plus a single interior wall at x=0. */
    IPLVector3 vertices[] = {
        {-3,0,-4}, {3,0,-4}, {3,3,-4}, {-3,3,-4},
        {-3,0,4}, {3,0,4}, {3,3,4}, {-3,3,4},
        {0,0,-3}, {0,3,-3}, {0,3,3}, {0,0,3}
    };
    IPLTriangle triangles[] = {
        {{0,1,2}}, {{0,2,3}}, {{4,6,5}}, {{4,7,6}},
        {{0,4,5}}, {{0,5,1}}, {{3,2,6}}, {{3,6,7}},
        {{0,3,7}}, {{0,7,4}}, {{1,5,6}}, {{1,6,2}},
        {{8,9,10}}, {{8,10,11}}
    };
    IPLMaterial material = {{0.10f,0.20f,0.30f}, 0.10f, {0.20f,0.10f,0.05f}};
    IPLint32 material_indices[14] = {0};
    IPLStaticMeshSettings mesh_settings = {0};
    mesh_settings.numVertices = 12;
    mesh_settings.numTriangles = 14;
    mesh_settings.numMaterials = 1;
    mesh_settings.vertices = vertices;
    mesh_settings.triangles = triangles;
    mesh_settings.materialIndices = material_indices;
    mesh_settings.materials = &material;
    CHECK(fn_iplStaticMeshCreate(scene, &mesh_settings, &mesh));
    fn_iplStaticMeshAdd(mesh, scene);
    fn_iplSceneCommit(scene);

    IPLSimulationSettings settings = {0};
    settings.flags = flags;
    settings.sceneType = IPL_SCENETYPE_DEFAULT;
    settings.reflectionType = reflection_type;
    settings.maxNumOcclusionSamples = 1;
    settings.maxNumRays = 4096;
    settings.numDiffuseSamples = 32;
    settings.maxDuration = 0.25f;
    settings.maxOrder = 1;
    settings.maxNumSources = 1;
    settings.numThreads = 2;
    settings.samplingRate = 48000;
    settings.frameSize = 512;
    CHECK(fn_iplSimulatorCreate(context, &settings, &simulator));
    fn_iplSimulatorSetScene(simulator, scene);
    IPLSourceSettings source_settings = {0};
    source_settings.flags = flags;
    CHECK(fn_iplSourceCreate(simulator, &source_settings, &source));
    fn_iplSourceAdd(source, simulator);
    source_added = 1;
    fn_iplSimulatorCommit(simulator);
    init_ms = now_ms() - init_start;

    IPLSimulationInputs inputs = {0};
    inputs.flags = flags;
    inputs.directFlags = IPL_DIRECTSIMULATIONFLAGS_DISTANCEATTENUATION |
        IPL_DIRECTSIMULATIONFLAGS_AIRABSORPTION | IPL_DIRECTSIMULATIONFLAGS_OCCLUSION |
        IPL_DIRECTSIMULATIONFLAGS_TRANSMISSION;
    inputs.source = coordinates(-1, 1, 0);
    inputs.occlusionType = IPL_OCCLUSIONTYPE_RAYCAST;
    inputs.numTransmissionRays = 1;
    inputs.reverbScale[0] = inputs.reverbScale[1] = inputs.reverbScale[2] = 1;
    fn_iplSourceSetInputs(source, flags, &inputs);
    IPLSimulationSharedInputs shared = {0};
    shared.listener = coordinates(-1, 1, 2);
    shared.numRays = 4096;
    shared.numBounces = 8;
    shared.duration = 0.25f;
    shared.order = 1;
    shared.irradianceMinDistance = 0.1f;
    fn_iplSimulatorSetSharedInputs(simulator, flags, &shared);
    double start = now_ms();
    fn_iplSimulatorRunDirect(simulator);
    fn_iplSourceGetOutputs(source, IPL_SIMULATIONFLAGS_DIRECT, &clear);
    shared.listener = coordinates(1, 1, 0);
    fn_iplSimulatorSetSharedInputs(simulator, flags, &shared);
    fn_iplSimulatorRunDirect(simulator);
    fn_iplSourceGetOutputs(source, IPL_SIMULATIONFLAGS_DIRECT, &blocked);
    direct_ms = now_ms() - start;
    EXPECT(fabsf(clear.direct.distanceAttenuation - 0.5f) < 1e-5f, "clear distance attenuation must be 0.5 at 2 m");
    EXPECT(fabsf(clear.direct.occlusion - 1.0f) < 1e-5f, "same-side segment must be unoccluded");
    EXPECT(fabsf(blocked.direct.occlusion) < 1e-5f, "wall-crossing segment must be occluded");
    for (int b = 0; b < IPL_NUM_BANDS; b++) {
        EXPECT(fabsf(blocked.direct.transmission[b] - material.transmission[b]) < 1e-5f, "single wall transmission must equal synthetic material value");
        EXPECT(isfinite(blocked.direct.airAbsorption[b]), "air absorption must be finite");
    }
    start = now_ms();
    fn_iplSimulatorRunReflections(simulator);
    reflection_ms = now_ms() - start;
    fn_iplSourceGetOutputs(source, IPL_SIMULATIONFLAGS_REFLECTIONS, &reflections);
    if (reflection_type == IPL_REFLECTIONEFFECTTYPE_PARAMETRIC) {
        for (int b = 0; b < IPL_NUM_BANDS; b++) {
            EXPECT(isfinite(reflections.reflections.reverbTimes[b]) && reflections.reflections.reverbTimes[b] > 0, "RT60 estimate must be finite and positive");
        }
    } else {
        EXPECT(reflections.reflections.ir != NULL, "convolution must provide an IR handle");
        IPLAudioSettings audio_settings = {48000, 512};
        IPLReflectionEffectSettings effect_settings = {IPL_REFLECTIONEFFECTTYPE_CONVOLUTION, 12000, 4};
        CHECK(fn_iplReflectionEffectCreate(context, &audio_settings, &effect_settings, &reflection_effect));
        float mono[512] = {0}, output[4][512] = {{0}};
        float* input_channels[1] = {mono};
        float* output_channels[4] = {output[0], output[1], output[2], output[3]};
        IPLAudioBuffer in_buffer = {1, 512, input_channels}, out_buffer = {4, 512, output_channels};
        IPLReflectionEffectParams params = reflections.reflections;
        params.type = IPL_REFLECTIONEFFECTTYPE_CONVOLUTION;
        params.irSize = 12000;
        params.numChannels = 4;
        mono[0] = 1;
        /* Capture a processed Dirac response numerically; no device playback. */
        for (int frame = 0; frame < 28; frame++) {
            fn_iplReflectionEffectApply(reflection_effect, &params, &in_buffer, &out_buffer, NULL);
            for (int c = 0; c < 4; c++) for (int s = 0; s < 512; s++) {
                finite_samples &= isfinite(output[c][s]);
                rendered_energy += (double)output[c][s] * output[c][s];
            }
            mono[0] = 0;
        }
        EXPECT(finite_samples && rendered_energy > 0, "rendered convolution impulse must have finite, non-zero energy");
    }

cleanup:
    if (reflection_effect) fn_iplReflectionEffectRelease(&reflection_effect);
    if (source_added) { fn_iplSourceRemove(source, simulator); fn_iplSimulatorCommit(simulator); }
    if (source) fn_iplSourceRelease(&source);
    if (simulator) fn_iplSimulatorRelease(&simulator);
    if (mesh) fn_iplStaticMeshRelease(&mesh);
    if (scene) fn_iplSceneRelease(&scene);
    if (context) fn_iplContextRelease(&context);
    int released = !reflection_effect && !source && !simulator && !mesh && !scene && !context;
    printf("{\"cycle\":%d,\"reflection_type\":\"%s\",\"status\":\"%s\",\"init_ms\":%.6f,\"two_direct_runs_ms\":%.6f,\"reflection_run_ms\":%.6f,\"clear_attenuation\":%.9g,\"clear_occlusion\":%.9g,\"blocked_occlusion\":%.9g,\"blocked_transmission\":[%.9g,%.9g,%.9g],\"reverb_times_s\":[%.9g,%.9g,%.9g],\"rendered_impulse_energy\":%.12g,\"released_handles_null\":%s}\n",
        cycle, reflection_type == IPL_REFLECTIONEFFECTTYPE_PARAMETRIC ? "parametric" : "convolution",
        (!failed && released) ? "PASS" : "FAIL", init_ms, direct_ms, reflection_ms,
        clear.direct.distanceAttenuation, clear.direct.occlusion, blocked.direct.occlusion,
        blocked.direct.transmission[0],blocked.direct.transmission[1],blocked.direct.transmission[2],
        reflections.reflections.reverbTimes[0],reflections.reflections.reverbTimes[1],reflections.reflections.reverbTimes[2],
        rendered_energy, released ? "true" : "false");
    return failed || !released;
    #undef CHECK
    #undef EXPECT
}

int main(int argc, char** argv) {
    if (argc != 2) { fprintf(stderr, "usage: smoke.exe absolute-path-to-phonon.dll\n"); return 2; }
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
    HMODULE library = LoadLibraryExA(argv[1], NULL, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
    if (!library) { fprintf(stderr, "LoadLibraryExA failed with Windows error %lu\n", (unsigned long)GetLastError()); return 3; }
    #define LOAD(name) do { FARPROC address = GetProcAddress(library, #name); \
        if (!address) { fprintf(stderr, "missing export %s\n", #name); FreeLibrary(library); return 4; } \
        _Static_assert(sizeof(fn_##name) == sizeof(address), "pointer size mismatch"); \
        memcpy(&fn_##name, &address, sizeof(address)); } while (0);
    APIS(LOAD)
    #undef LOAD
    int failed = run_cycle(1, IPL_REFLECTIONEFFECTTYPE_PARAMETRIC);
    failed |= run_cycle(2, IPL_REFLECTIONEFFECTTYPE_PARAMETRIC);
    failed |= run_cycle(3, IPL_REFLECTIONEFFECTTYPE_CONVOLUTION);
    FreeLibrary(library);
    return failed ? 1 : 0;
}
