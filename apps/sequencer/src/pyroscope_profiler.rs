use blocksense_config::SequencerConfig;
use blocksense_utils::read_file;
use tracing::info;

pub async fn setup_pyroscope(
    sequencer_config: &SequencerConfig,
) -> Option<pyroscope::PyroscopeAgent<pyroscope::pyroscope::PyroscopeAgentReady>> {
    let Some(pyroscope_config) = &sequencer_config.pyroscope_config else {
        info!("No pyroscope_config provided. Will not send diagnostic information to pyroscope server!");
        return None;
    };

    let url = pyroscope_config.url.clone();
    let samplerate = pyroscope_config.sample_rate;

    let application_name = format!("blocksense_sequencer_id_{}", sequencer_config.sequencer_id);

    let agent_builder = pyroscope::PyroscopeAgent::builder(url, application_name.to_string());

    let agent_builder = if let Some(user) = pyroscope_config.user.clone() {
        info!("Trying to read pyroscope server password ...");
        let password = read_file(
            pyroscope_config
                .password_file_path
                .clone()
                .expect("No password provided for pyroscope server matching username: {user}")
                .as_str(),
        );
        agent_builder.basic_auth(user, password)
    } else {
        agent_builder
    };

    let agent = match agent_builder
        .backend(pyroscope_pprofrs::pprof_backend(
            pyroscope_pprofrs::PprofConfig::new().sample_rate(samplerate),
        ))
        .tags([("app", "sequencer")].to_vec())
        .build()
    {
        Ok(a) => a,
        Err(e) => {
            panic!("Could not start PyroscopeAgent: {e}");
        }
    };

    Some(agent)
}
