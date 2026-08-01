#include <algorithm>
#include <chrono>
#include "../offlineGen/PreGen.h"
#include "MPSU.h"


void MPSU_test(u32 idx, u32 numElements, u32 numParties, u32 numThreads){
    oc::CuckooParam params = oc::CuckooIndex<>::selectParams(numElements, ssp, 0, 3);
    u32 numBins = params.numBins();   

    // generate share correlation
    ShareCorrelation sc(numParties, (numParties - 1) * numBins);
    if (!sc.exist("psu")){
        return;
    }
    
    // generate set
    std::vector<block> set(numElements);
    for (u32 i = 0; i < numElements; i++){
        set[i] = oc::toBlock(idx + i + 2);
    }

    if (idx == 0){
        std::vector<block> out;
        const auto startedAt = std::chrono::steady_clock::now();
        out = MPSUParty(idx, numParties, numElements, set, numThreads);
        const auto finishedAt = std::chrono::steady_clock::now();
        const double onlineMs = std::chrono::duration<double, std::milli>(finishedAt - startedAt).count();
        const u32 expectedSize = numElements + numParties - 1;
        const u32 nn = oc::log2ceil(numElements);
        const bool success = out.size() == expectedSize;
        if(success){
            std::cout <<"k_" << numParties << ", nn_" << nn <<  ": MPSU success! " << std::endl;
        }
        else{
            std::cout << "wrong union size: " << out.size() << std::endl;
        }
        std::cout << "MPSO_RESULT_JSON {\"success\":" << (success ? "true" : "false")
                  << ",\"protocol\":\"MPSU\",\"parties\":" << numParties
                  << ",\"datasetPower\":" << nn << ",\"setSize\":" << numElements
                  << ",\"resultType\":\"union\",\"resultCount\":" << out.size()
                  << ",\"expectedCount\":" << expectedSize << ",\"onlineMs\":"
                  << std::fixed << std::setprecision(6) << onlineMs << "}" << std::endl;
    } else {
        MPSUParty(idx, numParties, numElements, set, numThreads);
    }
    sc.release();
    return ;
}




int main(int agrc, char** argv){
    CLP cmd;
    cmd.parse(agrc, argv);
    u32 nn = cmd.getOr("nn", 14);
    u32 n = cmd.getOr("n", 1ull << nn);
    u32 k = cmd.getOr("k", 3);
    u32 nt = cmd.getOr("nt", 1);
    u32 idx = cmd.getOr("r", -1);

    bool preGen = cmd.isSet("preGen");
    bool help = cmd.isSet("h");

    if (help){
        std::cout << "protocol: multi-party private set union" << std::endl;
        std::cout << "parameters" << std::endl;
        std::cout << "    -n:           number of elements in each set, default 1024" << std::endl;
        std::cout << "    -nn:          logarithm of the number of elements in each set, default 10" << std::endl;
        std::cout << "    -k:           number of parties, default 3" << std::endl;
        std::cout << "    -nt:          number of threads, default 1" << std::endl;
        std::cout << "    -r:           index of party" << std::endl;
        std::cout << "    -preGen:       set up offline stage" << std::endl;
        return 0;
    }    

    if ((idx >= k || idx < 0)){
        std::cout << "wrong idx of party, please use -h to print help information" << std::endl;
        return 0;
    }

    if (preGen){
        MPSUpreGen(idx, k, nn, nt);
    } 
    else MPSU_test(idx, n, k, nt);    

    return 0;
}

