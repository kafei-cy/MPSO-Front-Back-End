#include <taihang/common/config.hpp>
#include <taihang/mpc/pso/mqrpmt_pso.hpp>

#include <linux/tcp.h>
#include <netinet/in.h>
#include <omp.h>
#include <openssl/obj_mac.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <future>
#include <iostream>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

using taihang::BigInt;
using taihang::Block;
using taihang::ZnElement;
using taihang::config::thread_num;
using taihang::make_block;
namespace mqrpmt = taihang::mpc::cwprf_mqrpmt;
namespace pso = taihang::mpc::mqrpmt_pso;

namespace {

using Clock = std::chrono::steady_clock;
using Milliseconds = std::chrono::duration<double, std::milli>;

constexpr int kMinPower = 12;
constexpr int kMaxPower = 20;
constexpr int kMaxThreads = 64;
constexpr uint16_t kDefaultPort = 19620;
constexpr int kMqRpmtCurveId = NID_X25519;
constexpr mqrpmt::MembershipMode kMembershipMode =
    mqrpmt::MembershipMode::PlainSet;
constexpr std::string_view kCurveName = "X25519";
constexpr std::string_view kMembershipName = "PlainSet";

struct Options {
    pso::PsoMode mode = pso::PsoMode::kIntersection;
    std::string mode_name = "psi";
    int power = kMinPower;
    int threads = 4;
    uint16_t port = kDefaultPort;
};

struct Dataset {
    std::vector<Block> sender_set;
    std::vector<Block> receiver_set;
    size_t intersection_size = 0;
    size_t union_size = 0;
    uint64_t intersection_sum = 0;
};

struct ChannelTraffic {
    uint64_t sent_bytes = 0;
    uint64_t received_bytes = 0;
};

struct SenderResult {
    pso::SenderOutput output;
    double milliseconds = 0.0;
    ChannelTraffic traffic;
};

struct ReceiverResult {
    pso::ReceiverOutput output;
    double milliseconds = 0.0;
    ChannelTraffic traffic;
};

struct ProtocolResult {
    SenderResult sender;
    ReceiverResult receiver;
    double wall_milliseconds = 0.0;
};

[[noreturn]] void fail_usage(const std::string& message) {
    throw std::invalid_argument(
        message + "\nUsage: taihang_pso_adapter --mode <psi|psu|psic|psics> "
                  "--power <12|14|16|18|20> --threads <1-64> [--port <1-65535>]");
}

int parse_integer(const std::string& value, const std::string& name) {
    size_t consumed = 0;
    long parsed = 0;
    try {
        parsed = std::stol(value, &consumed, 10);
    } catch (const std::exception&) {
        fail_usage(name + " must be an integer");
    }
    if (consumed != value.size() || parsed < std::numeric_limits<int>::min() ||
        parsed > std::numeric_limits<int>::max()) {
        fail_usage(name + " must be an integer");
    }
    return static_cast<int>(parsed);
}

Options parse_options(int argc, char** argv) {
    Options options;
    bool has_mode = false;
    bool has_power = false;
    bool has_threads = false;

    for (int index = 1; index < argc; index += 2) {
        if (index + 1 >= argc) {
            fail_usage(std::string(argv[index]) + " requires a value");
        }
        const std::string key = argv[index];
        const std::string value = argv[index + 1];
        if (key == "--mode") {
            has_mode = true;
            options.mode_name = value;
            if (value == "psi") {
                options.mode = pso::PsoMode::kIntersection;
            } else if (value == "psu") {
                options.mode = pso::PsoMode::kUnion;
            } else if (value == "psic") {
                options.mode = pso::PsoMode::kCard;
            } else if (value == "psics") {
                options.mode = pso::PsoMode::kCardSum;
            } else {
                fail_usage("Unsupported mode: " + value);
            }
        } else if (key == "--power") {
            has_power = true;
            options.power = parse_integer(value, "power");
        } else if (key == "--threads") {
            has_threads = true;
            options.threads = parse_integer(value, "threads");
        } else if (key == "--port") {
            const int port = parse_integer(value, "port");
            if (port < 1 || port > 65535) {
                fail_usage("port must be between 1 and 65535");
            }
            options.port = static_cast<uint16_t>(port);
        } else {
            fail_usage("Unsupported option: " + key);
        }
    }

    if (!has_mode || !has_power || !has_threads) {
        fail_usage("mode, power, and threads are required");
    }
    if (options.power < kMinPower || options.power > kMaxPower ||
        options.power % 2 != 0) {
        fail_usage("power must be one of 12, 14, 16, 18, or 20");
    }
    if (options.threads < 1 || options.threads > kMaxThreads) {
        fail_usage("threads must be between 1 and 64");
    }
    return options;
}

Dataset make_dataset(size_t set_size) {
    Dataset dataset;
    dataset.sender_set.resize(set_size);
    dataset.receiver_set.resize(set_size);
    dataset.intersection_size = set_size - 1;
    dataset.union_size = set_size + 1;
    dataset.intersection_sum =
        static_cast<uint64_t>(set_size) * (set_size + 1) / 2 - 1;

    constexpr uint64_t kReceiverDomain = 0x5252525252525252ULL;
    constexpr uint64_t kSenderOnlyDomain = 0x5858585858585858ULL;
    for (size_t index = 0; index < set_size; ++index) {
        dataset.receiver_set[index] =
            make_block(kReceiverDomain, static_cast<uint64_t>(index + 1));
    }
    for (size_t index = 0; index + 1 < set_size; ++index) {
        dataset.sender_set[index] = dataset.receiver_set[index + 1];
    }
    dataset.sender_set.back() =
        make_block(kSenderOnlyDomain, static_cast<uint64_t>(set_size + 1));
    return dataset;
}

std::vector<ZnElement> make_values(const pso::PublicParameters& parameters,
                                   size_t set_size) {
    std::vector<ZnElement> values;
    values.reserve(set_size);
    for (size_t index = 0; index + 1 < set_size; ++index) {
        values.emplace_back(parameters.ring_ctx,
                            BigInt(static_cast<uint64_t>(index + 2)));
    }
    values.emplace_back(parameters.ring_ctx,
                        BigInt(static_cast<uint64_t>(set_size + 1)));
    return values;
}

ChannelTraffic tcp_channel_traffic(int socket_fd) {
    struct tcp_info information {};
    socklen_t length = sizeof(information);
    if (::getsockopt(socket_fd, IPPROTO_TCP, TCP_INFO, &information, &length) != 0) {
        throw std::runtime_error("Unable to read TCP communication counters");
    }
    constexpr size_t kRequiredLength =
        offsetof(struct tcp_info, tcpi_bytes_sent) +
        sizeof(information.tcpi_bytes_sent);
    if (length < kRequiredLength) {
        throw std::runtime_error("The Linux kernel does not expose TCP byte counters");
    }
    return ChannelTraffic{
        information.tcpi_bytes_sent,
        information.tcpi_bytes_received,
    };
}

ChannelTraffic traffic_delta(const ChannelTraffic& after,
                             const ChannelTraffic& before) {
    if (after.sent_bytes < before.sent_bytes ||
        after.received_bytes < before.received_bytes) {
        throw std::runtime_error("TCP communication counters moved backwards");
    }
    return ChannelTraffic{
        after.sent_bytes - before.sent_bytes,
        after.received_bytes - before.received_bytes,
    };
}

ProtocolResult run_protocol(const Options& options,
                            const pso::PublicParameters& parameters,
                            const Dataset& dataset,
                            const std::vector<ZnElement>& values) {
    constexpr std::string_view kAddress = "127.0.0.1";
    const auto wall_begin = Clock::now();

    auto sender_future = std::async(std::launch::async, [&] {
        taihang::net::NetIO io("server", std::string(kAddress), options.port);
        const ChannelTraffic traffic_before =
            tcp_channel_traffic(io.get_socket_fd());
        const auto begin = Clock::now();
        pso::SenderOutput output = pso::pso_sender(
            io, parameters, dataset.sender_set, options.mode, values);
        const double milliseconds = Milliseconds(Clock::now() - begin).count();
        const ChannelTraffic traffic_after =
            tcp_channel_traffic(io.get_socket_fd());
        return SenderResult{
            std::move(output),
            milliseconds,
            traffic_delta(traffic_after, traffic_before),
        };
    });

    auto receiver_future = std::async(std::launch::async, [&] {
        taihang::net::NetIO io("client", std::string(kAddress), options.port);
        const ChannelTraffic traffic_before =
            tcp_channel_traffic(io.get_socket_fd());
        const auto begin = Clock::now();
        pso::ReceiverOutput output = pso::pso_receiver(
            io, parameters, dataset.receiver_set, options.mode);
        const double milliseconds = Milliseconds(Clock::now() - begin).count();
        const ChannelTraffic traffic_after =
            tcp_channel_traffic(io.get_socket_fd());
        return ReceiverResult{
            std::move(output),
            milliseconds,
            traffic_delta(traffic_after, traffic_before),
        };
    });

    ProtocolResult result;
    result.sender = sender_future.get();
    result.receiver = receiver_future.get();
    result.wall_milliseconds = Milliseconds(Clock::now() - wall_begin).count();
    return result;
}

size_t result_count(const Options& options, const ProtocolResult& result) {
    switch (options.mode) {
        case pso::PsoMode::kIntersection:
        case pso::PsoMode::kUnion:
            return result.receiver.output.set_result.size();
        case pso::PsoMode::kCard:
        case pso::PsoMode::kCardSum:
            return result.receiver.output.cardinality;
    }
    throw std::runtime_error("Unknown PSO mode");
}

std::string result_type(const Options& options) {
    switch (options.mode) {
        case pso::PsoMode::kIntersection:
            return "intersection";
        case pso::PsoMode::kUnion:
            return "union";
        case pso::PsoMode::kCard:
            return "intersection-cardinality";
        case pso::PsoMode::kCardSum:
            return "intersection-sum";
    }
    throw std::runtime_error("Unknown PSO mode");
}

size_t expected_count(const Options& options, const Dataset& dataset) {
    return options.mode == pso::PsoMode::kUnion ? dataset.union_size
                                                : dataset.intersection_size;
}

bool validate(const Options& options,
              const Dataset& dataset,
              const ProtocolResult& result) {
    if (result_count(options, result) != expected_count(options, dataset)) {
        return false;
    }
    if (options.mode != pso::PsoMode::kCardSum) {
        return true;
    }
    return result.sender.output.cardinality == dataset.intersection_size &&
           result.sender.output.card_sum.value.to_uint64() ==
               dataset.intersection_sum;
}

void print_json(const Options& options,
                const Dataset& dataset,
                const ProtocolResult& result) {
    const size_t count = result_count(options, result);
    const size_t expected = expected_count(options, dataset);
    // Received payload is counted once per direction and excludes TCP retransmits.
    const uint64_t communication_bytes =
        result.sender.traffic.received_bytes +
        result.receiver.traffic.received_bytes;

    std::cout << "TAIHANG_RESULT_JSON {"
              << "\"success\":" << (validate(options, dataset, result) ? "true" : "false")
              << ",\"protocol\":\"" << options.mode_name << "\""
              << ",\"parties\":2"
              << ",\"datasetPower\":" << options.power
              << ",\"setSize\":" << dataset.sender_set.size()
              << ",\"resultType\":\"" << result_type(options) << "\"";

    if (options.mode == pso::PsoMode::kCardSum) {
        std::cout << ",\"resultSum\":"
                  << result.sender.output.card_sum.value.to_uint64()
                  << ",\"expectedSum\":" << dataset.intersection_sum;
    } else {
        std::cout << ",\"resultCount\":" << count
                  << ",\"expectedCount\":" << expected;
    }

    std::cout << ",\"onlineMs\":" << result.wall_milliseconds
              // Taihang PSO is an online-only protocol in this adapter.
              << ",\"preparationMs\":0"
              << ",\"communicationBytes\":" << communication_bytes
              << ",\"communicationMiB\":"
              << static_cast<double>(communication_bytes) / (1024.0 * 1024.0)
              << ",\"communicationMethod\":\"tcp-delivered-payload\""
              << ",\"senderSentBytes\":" << result.sender.traffic.sent_bytes
              << ",\"senderReceivedBytes\":"
              << result.sender.traffic.received_bytes
              << ",\"receiverSentBytes\":"
              << result.receiver.traffic.sent_bytes
              << ",\"receiverReceivedBytes\":"
              << result.receiver.traffic.received_bytes
              << ",\"senderMs\":" << result.sender.milliseconds
              << ",\"receiverMs\":" << result.receiver.milliseconds
              << ",\"threads\":" << options.threads
              << ",\"curve\":\"" << kCurveName << "\""
              << ",\"membership\":\"" << kMembershipName << "\"}"
              << std::endl;
}

}  // namespace

int main(int argc, char** argv) {
    try {
        const Options options = parse_options(argc, argv);
        thread_num = options.threads;
        omp_set_num_threads(options.threads);

        const size_t set_size = size_t{1} << options.power;
        const Dataset dataset = make_dataset(set_size);
        const bool needs_ring = options.mode == pso::PsoMode::kCardSum;
        const pso::PublicParameters parameters = pso::setup(
            NID_X9_62_prime256v1,
            kMqRpmtCurveId,
            static_cast<size_t>(options.power),
            static_cast<size_t>(options.power),
            needs_ring ? static_cast<size_t>(2 * options.power + 2) : 0,
            needs_ring ? static_cast<size_t>(options.power + 1) : 0,
            kMembershipMode,
            std::nullopt);
        const std::vector<ZnElement> values = needs_ring
            ? make_values(parameters, set_size)
            : std::vector<ZnElement>{};
        const ProtocolResult result =
            run_protocol(options, parameters, dataset, values);
        print_json(options, dataset, result);
        return validate(options, dataset, result) ? 0 : 2;
    } catch (const std::exception& error) {
        std::cerr << "Taihang PSO adapter failed: " << error.what() << std::endl;
        return 1;
    }
}
