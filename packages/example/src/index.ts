import { Evem, EventCoreOn, OnVersionPlanData } from 'evem';

async function main() {
  const evemCli = new Evem();
  EventCoreOn.onVersionPlan((data: OnVersionPlanData[]) => {
    console.log(data);
  });
  await evemCli.execute(['-s', 'version', '--list']);
}

main();
